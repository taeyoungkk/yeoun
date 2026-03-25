package com.yeoun.domain.locationlog.service;

import com.yeoun.domain.locationlog.dto.request.LocationLogBatchUploadRequest;
import com.yeoun.domain.locationlog.dto.request.LocationLogUploadItemRequest;
import com.yeoun.domain.locationlog.dto.response.LocationLogBatchUploadResponse;
import com.yeoun.domain.locationlog.event.LocationLogBatchStoredEvent;
import com.yeoun.domain.locationlog.event.LocationLogBatchStoredEventItem;
import com.yeoun.domain.locationlog.event.LocationLogBatchStoredEventPublisher;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.tripprocessing.service.TripProcessingStatusService;
import com.yeoun.domain.tripsync.service.TripSyncStatusService;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class LocationLogService {

    private static final Logger log = LoggerFactory.getLogger(LocationLogService.class);

    private final TripRepository tripRepository;
    private final LocationLogBatchStoredEventPublisher locationLogBatchStoredEventPublisher;
    private final TripProcessingStatusService tripProcessingStatusService;
    private final TripSyncStatusService tripSyncStatusService;

    public LocationLogService(
            TripRepository tripRepository,
            LocationLogBatchStoredEventPublisher locationLogBatchStoredEventPublisher,
            TripProcessingStatusService tripProcessingStatusService,
            TripSyncStatusService tripSyncStatusService
    ) {
        this.tripRepository = tripRepository;
        this.locationLogBatchStoredEventPublisher = locationLogBatchStoredEventPublisher;
        this.tripProcessingStatusService = tripProcessingStatusService;
        this.tripSyncStatusService = tripSyncStatusService;
    }

    @Transactional
    public LocationLogBatchUploadResponse uploadBatch(UUID requesterUserId, UUID tripId, LocationLogBatchUploadRequest request) {
        // 삭제되지 않은 여행만 위치 로그 수집 요청 대상이 된다.
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        // 현재 정책상 위치 로그 수집 요청은 여행 owner만 허용한다.
        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            log.warn(
                    "위치 로그 업로드 거절: 요청 사용자가 여행 소유자가 아님. tripId={} requesterUserId={} ownerUserId={}",
                    tripId,
                    requesterUserId,
                    trip.getOwnerUserId()
            );
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
        // 여행이 진행 중이거나 종료된 뒤에만 위치 로그 수집 요청을 받는다.
        if (trip.getStatus() != TripStatus.ACTIVE && trip.getStatus() != TripStatus.ENDED) {
            log.warn(
                    "위치 로그 업로드 거절: 업로드 불가능한 여행 상태. tripId={} requesterUserId={} tripStatus={}",
                    tripId,
                    requesterUserId,
                    trip.getStatus()
            );
            throw new BaseException(ErrorCode.TRIP_LOCATION_LOG_UPLOAD_NOT_ALLOWED);
        }

        List<LocationLogUploadItemRequest> logs = request.logs();
        LinkedHashSet<String> acceptedClientLogUuids = new LinkedHashSet<>();
        for (LocationLogUploadItemRequest log : logs) {
            acceptedClientLogUuids.add(log.clientLogUuid().trim());
        }

        Instant now = Instant.now();
        LocationLogUploadItemRequest firstLog = logs.get(0);
        LocationLogUploadItemRequest lastLog = logs.get(logs.size() - 1);
        log.info(
                "위치 로그 업로드 접수 완료. tripId={} requesterUserId={} logCount={} firstClientLogUuid={} firstRecordedAt={} lastClientLogUuid={} lastRecordedAt={}",
                tripId,
                requesterUserId,
                logs.size(),
                firstLog.clientLogUuid().trim(),
                firstLog.recordedAt(),
                lastLog.clientLogUuid().trim(),
                lastLog.recordedAt()
        );
        tripSyncStatusService.startLocationProcessing(tripId, now);
        tripProcessingStatusService.markPending(tripId, now);

        // raw 저장은 더 이상 API 서버가 하지 않고, 컨슈머가 저장할 수 있도록 GPS batch 본문을 Kafka에 싣는다.
        locationLogBatchStoredEventPublisher.publish(new LocationLogBatchStoredEvent(
                tripId,
                requesterUserId,
                now,
                logs.stream()
                        .map(this::toEventItem)
                        .toList()
        ));
        tripProcessingStatusService.markQueued(tripId, now);
        log.info(
                "위치 로그 Kafka 적재 요청 완료. tripId={} requesterUserId={} acceptedCount={} requestedAt={}",
                tripId,
                requesterUserId,
                acceptedClientLogUuids.size(),
                now
        );

        return new LocationLogBatchUploadResponse(
                tripId,
                requesterUserId,
                acceptedClientLogUuids.size(),
                List.copyOf(acceptedClientLogUuids),
                now
        );
    }

    private LocationLogBatchStoredEventItem toEventItem(LocationLogUploadItemRequest log) {
        return new LocationLogBatchStoredEventItem(
                log.clientLogUuid().trim(),
                log.recordedAt(),
                log.latitude(),
                log.longitude(),
                log.accuracyM(),
                log.speedMps(),
                log.heading(),
                log.source()
        );
    }
}
