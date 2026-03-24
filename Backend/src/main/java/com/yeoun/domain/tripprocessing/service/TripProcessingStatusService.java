package com.yeoun.domain.tripprocessing.service;

import com.yeoun.domain.locationlog.dto.response.LocationLogProcessingStatusResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.tripprocessing.entity.TripProcessingStatus;
import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;
import com.yeoun.domain.tripprocessing.repository.TripProcessingStatusRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TripProcessingStatusService {

    private static final Logger log = LoggerFactory.getLogger(TripProcessingStatusService.class);

    private final TripProcessingStatusRepository tripProcessingStatusRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public TripProcessingStatusService(
            TripProcessingStatusRepository tripProcessingStatusRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.tripProcessingStatusRepository = tripProcessingStatusRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public LocationLogProcessingStatusResponse getLocationLogStatus(UUID requesterUserId, UUID tripId) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);

        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_PROCESSING_STATUS_NOT_FOUND));

        log.info(
                "위치 처리 상태 조회 완료. tripId={} requesterUserId={} status={} lastRequestedAt={} lastProcessedAt={} lastErrorMessage={}",
                tripId,
                requesterUserId,
                status.getStatus(),
                status.getLastRequestedAt(),
                status.getLastProcessedAt(),
                status.getLastErrorMessage()
        );

        return new LocationLogProcessingStatusResponse(
                status.getTripId(),
                status.getStatus(),
                status.getLastRequestedAt(),
                status.getLastProcessedAt(),
                status.getLastErrorMessage()
        );
    }

    @Transactional
    public void markPending(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseGet(() -> TripProcessingStatus.builder()
                        .tripId(tripId)
                        .status(TripProcessingStatusType.PENDING)
                        .createdAt(now)
                        .updatedAt(now)
                        .build());

        // 새 raw 로그가 들어오면 이후 워커 재처리가 필요하므로 다시 PENDING으로 돌린다.
        status.markPending(now);
        tripProcessingStatusRepository.save(status);
        log.info("위치 처리 상태를 PENDING으로 변경. tripId={} at={}", tripId, now);
    }

    @Transactional
    public void markQueued(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseThrow();
        status.markQueued(now);
        tripProcessingStatusRepository.save(status);
        log.info("위치 처리 상태를 QUEUED로 변경. tripId={} at={}", tripId, now);
    }

    @Transactional
    public void markProcessing(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseThrow();
        status.markProcessing(now);
        tripProcessingStatusRepository.save(status);
        log.info("위치 처리 상태를 PROCESSING으로 변경. tripId={} at={}", tripId, now);
    }

    @Transactional
    public void markReady(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseThrow();
        status.markReady(now);
        tripProcessingStatusRepository.save(status);
        log.info("위치 처리 상태를 READY로 변경. tripId={} at={}", tripId, now);
    }

    @Transactional
    public void markFailed(UUID tripId, Instant now, String errorMessage) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseGet(() -> TripProcessingStatus.builder()
                        .tripId(tripId)
                        .status(TripProcessingStatusType.FAILED)
                        .createdAt(now)
                        .updatedAt(now)
                        .build());
        status.markFailed(now, errorMessage);
        tripProcessingStatusRepository.save(status);
        log.error("위치 처리 상태를 FAILED로 변경. tripId={} at={} errorMessage={}", tripId, now, errorMessage);
    }

    private void validateTripAccessible(UUID requesterUserId, Trip trip) {
        boolean isOwner = trip.getOwnerUserId().equals(requesterUserId);
        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isOwner && !isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }
}
