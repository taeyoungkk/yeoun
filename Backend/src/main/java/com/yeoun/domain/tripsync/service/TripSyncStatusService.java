package com.yeoun.domain.tripsync.service;

import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.tripsync.dto.response.TripSyncStatusResponse;
import com.yeoun.domain.tripsync.entity.TripSyncStatus;
import com.yeoun.domain.tripsync.repository.TripSyncStatusRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TripSyncStatusService {

    private final TripSyncStatusRepository tripSyncStatusRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public TripSyncStatusService(
            TripSyncStatusRepository tripSyncStatusRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.tripSyncStatusRepository = tripSyncStatusRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public TripSyncStatusResponse getTripSyncStatus(UUID requesterUserId, UUID tripId) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);

        TripSyncStatus tripSyncStatus = tripSyncStatusRepository.findById(tripId)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        return new TripSyncStatusResponse(
                tripSyncStatus.getTripId(),
                tripSyncStatus.getSyncStatus(),
                tripSyncStatus.getRouteVersion(),
                tripSyncStatus.getTimelineVersion(),
                tripSyncStatus.getPhotoVersion(),
                tripSyncStatus.getUpdatedAt(),
                tripSyncStatus.getLastErrorMessage()
        );
    }

    @Transactional
    public void markProcessing(UUID tripId, Instant now) {
        TripSyncStatus tripSyncStatus = getTripSyncStatusEntity(tripId);
        tripSyncStatus.markProcessing(now);
    }

    @Transactional
    public void markCompleted(UUID tripId, Instant now) {
        TripSyncStatus tripSyncStatus = getTripSyncStatusEntity(tripId);
        tripSyncStatus.markCompleted(now);
    }

    @Transactional
    public void markFailed(UUID tripId, Instant now, String errorMessage) {
        TripSyncStatus tripSyncStatus = getTripSyncStatusEntity(tripId);
        tripSyncStatus.markFailed(now, errorMessage);
    }

    @Transactional
    public void increaseRouteVersion(UUID tripId, Instant now) {
        TripSyncStatus tripSyncStatus = getTripSyncStatusEntity(tripId);
        tripSyncStatus.increaseRouteVersion(now);
    }

    @Transactional
    public void increaseTimelineVersion(UUID tripId, Instant now) {
        TripSyncStatus tripSyncStatus = getTripSyncStatusEntity(tripId);
        tripSyncStatus.increaseTimelineVersion(now);
    }

    @Transactional
    public void increasePhotoVersion(UUID tripId, Instant now) {
        TripSyncStatus tripSyncStatus = getTripSyncStatusEntity(tripId);
        tripSyncStatus.increasePhotoVersion(now);
    }

    private TripSyncStatus getTripSyncStatusEntity(UUID tripId) {
        return tripSyncStatusRepository.findById(tripId)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
    }

    private void validateTripAccessible(UUID requesterUserId, Trip trip) {
        if (trip.getOwnerUserId().equals(requesterUserId)) {
            return;
        }

        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }
}
