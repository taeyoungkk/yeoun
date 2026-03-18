package com.yeoun.domain.locationlog.service;

import com.yeoun.domain.locationlog.dto.request.LocationLogBatchUploadRequest;
import com.yeoun.domain.locationlog.dto.request.LocationLogUploadItemRequest;
import com.yeoun.domain.locationlog.dto.response.LocationLogBatchUploadResponse;
import com.yeoun.domain.locationlog.event.LocationLogBatchStoredEvent;
import com.yeoun.domain.locationlog.event.LocationLogBatchStoredEventPublisher;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class LocationLogService {

    private final TripRepository tripRepository;
    private final LocationLogBatchStoredEventPublisher locationLogBatchStoredEventPublisher;

    public LocationLogService(
            TripRepository tripRepository,
            LocationLogBatchStoredEventPublisher locationLogBatchStoredEventPublisher
    ) {
        this.tripRepository = tripRepository;
        this.locationLogBatchStoredEventPublisher = locationLogBatchStoredEventPublisher;
    }

    @Transactional
    public LocationLogBatchUploadResponse uploadBatch(UUID requesterUserId, UUID tripId, LocationLogBatchUploadRequest request) {
        // 삭제되지 않은 여행만 위치 로그 수집 요청 대상이 된다.
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        // 현재 정책상 위치 로그 수집 요청은 여행 owner만 허용한다.
        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
        // 여행이 진행 중이거나 종료된 뒤에만 위치 로그 수집 요청을 받는다.
        if (trip.getStatus() != TripStatus.ACTIVE && trip.getStatus() != TripStatus.ENDED) {
            throw new BaseException(ErrorCode.TRIP_LOCATION_LOG_UPLOAD_NOT_ALLOWED);
        }

        List<LocationLogUploadItemRequest> logs = request.logs();
        LinkedHashSet<String> acceptedClientLogUuids = new LinkedHashSet<>();
        for (LocationLogUploadItemRequest log : logs) {
            acceptedClientLogUuids.add(log.clientLogUuid().trim());
        }

        Instant now = Instant.now();

        // raw 저장은 더 이상 API 서버가 하지 않고, Kafka에 적재 이벤트만 발행한다.
        locationLogBatchStoredEventPublisher.publish(new LocationLogBatchStoredEvent(
                tripId,
                requesterUserId,
                logs.size(),
                now
        ));

        return new LocationLogBatchUploadResponse(
                tripId,
                requesterUserId,
                acceptedClientLogUuids.size(),
                logs.size() - acceptedClientLogUuids.size(),
                List.copyOf(acceptedClientLogUuids)
        );
    }
}
