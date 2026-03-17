package com.yeoun.domain.locationlog.service;

import com.yeoun.domain.locationlog.dto.request.LocationLogBatchUploadRequest;
import com.yeoun.domain.locationlog.dto.request.LocationLogUploadItemRequest;
import com.yeoun.domain.locationlog.dto.response.LocationLogBatchUploadResponse;
import com.yeoun.domain.locationlog.entity.LocationLogRaw;
import com.yeoun.domain.locationlog.repository.LocationLogRawRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class LocationLogService {

    private final TripRepository tripRepository;
    private final LocationLogRawRepository locationLogRawRepository;

    public LocationLogService(
            TripRepository tripRepository,
            LocationLogRawRepository locationLogRawRepository
    ) {
        this.tripRepository = tripRepository;
        this.locationLogRawRepository = locationLogRawRepository;
    }

    @Transactional
    public LocationLogBatchUploadResponse uploadBatch(UUID requesterUserId, UUID tripId, LocationLogBatchUploadRequest request) {
        // 삭제되지 않은 여행만 위치 로그 업로드 대상이 된다.
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        // 현재 정책상 위치 로그 업로드는 여행 owner만 허용한다.
        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
        // 여행이 진행 중이거나 종료된 뒤에만 남은 로그 업로드를 허용한다.
        if (trip.getStatus() != TripStatus.ACTIVE && trip.getStatus() != TripStatus.ENDED) {
            throw new BaseException(ErrorCode.TRIP_LOCATION_LOG_UPLOAD_NOT_ALLOWED);
        }

        List<LocationLogUploadItemRequest> logs = request.logs();
        LinkedHashSet<String> uniqueClientLogUuids = new LinkedHashSet<>();
        for (LocationLogUploadItemRequest log : logs) {
            uniqueClientLogUuids.add(log.clientLogUuid().trim());
        }

        // 같은 clientLogUuid가 이미 저장되어 있으면 재전송으로 보고 중복 저장하지 않는다.
        Set<String> existingClientLogUuids = locationLogRawRepository
                .findByTripIdAndUserIdAndClientLogUuidIn(tripId, requesterUserId, uniqueClientLogUuids)
                .stream()
                .map(LocationLogRaw::getClientLogUuid)
                .collect(java.util.stream.Collectors.toSet());

        Instant now = Instant.now();
        List<LocationLogRaw> newLogs = new ArrayList<>();
        LinkedHashSet<String> ackedClientLogUuids = new LinkedHashSet<>();
        Set<String> queuedClientLogUuids = new LinkedHashSet<>();

        for (LocationLogUploadItemRequest log : logs) {
            String trimmedClientLogUuid = log.clientLogUuid().trim();
            if (existingClientLogUuids.contains(trimmedClientLogUuid)) {
                // 이미 서버가 가진 로그도 ack에는 포함해 프론트가 재전송을 멈출 수 있게 한다.
                ackedClientLogUuids.add(trimmedClientLogUuid);
                continue;
            }

            if (!queuedClientLogUuids.add(trimmedClientLogUuid)) {
                // 한 요청 안에서 같은 UUID가 반복되면 첫 건만 저장 대상으로 본다.
                ackedClientLogUuids.add(trimmedClientLogUuid);
                continue;
            }

            // DTO를 raw 로그 엔티티로 변환해 일괄 저장 목록에 모은다.
            newLogs.add(LocationLogRaw.builder()
                    .locationLogId(UUID.randomUUID())
                    .tripId(tripId)
                    .userId(requesterUserId)
                    .recordedAt(log.recordedAt())
                    .latitude(log.latitude())
                    .longitude(log.longitude())
                    .accuracyM(log.accuracyM())
                    .speedMps(log.speedMps())
                    .heading(log.heading())
                    .source(log.source())
                    .clientLogUuid(trimmedClientLogUuid)
                    .createdAt(now)
                    .build());
            ackedClientLogUuids.add(trimmedClientLogUuid);
        }

        if (!newLogs.isEmpty()) {
            // 새 로그만 한 번에 저장한다.
            locationLogRawRepository.saveAll(newLogs);
        }

        return new LocationLogBatchUploadResponse(
                tripId,
                requesterUserId,
                newLogs.size(),
                logs.size() - newLogs.size(),
                List.copyOf(ackedClientLogUuids)
        );
    }
}
