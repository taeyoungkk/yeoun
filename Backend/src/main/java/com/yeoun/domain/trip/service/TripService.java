package com.yeoun.domain.trip.service;

import com.yeoun.domain.trip.dto.request.TripCreateRequest;
import com.yeoun.domain.trip.dto.request.TripInviteUsersRequest;
import com.yeoun.domain.trip.dto.response.TripCreateResponse;
import com.yeoun.domain.trip.dto.response.TripInviteUsersResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripReportStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TripService {

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final UserRepository userRepository;

    public TripService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            UserRepository userRepository
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public TripCreateResponse createTrip(UUID ownerUserId, TripCreateRequest request) {
        validateDateRange(request);

        Instant now = Instant.now();
        TripVisibility visibility = request.visibility() == null ? TripVisibility.PRIVATE : request.visibility();

        Trip trip = Trip.builder()
                .tripId(UUID.randomUUID())
                .ownerUserId(ownerUserId)
                .title(request.title().trim())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .status(TripStatus.DRAFT)
                .visibility(visibility)
                .reportStatus(TripReportStatus.PENDING)
                .createdAt(now)
                .updatedAt(now)
                .build();
        tripRepository.save(trip);

        TripMember ownerMember = TripMember.builder()
                .tripMemberId(UUID.randomUUID())
                .tripId(trip.getTripId())
                .userId(ownerUserId)
                .inviteStatus(TripMemberInviteStatus.ACCEPTED)
                .invitedByUserId(null)
                .invitedAt(null)
                .joinedAt(now)
                .leftAt(null)
                .createdAt(now)
                .build();
        tripMemberRepository.save(ownerMember);

        return new TripCreateResponse(
                trip.getTripId(),
                trip.getTitle(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getStatus(),
                trip.getVisibility(),
                trip.getCreatedAt()
        );
    }

    private void validateDateRange(TripCreateRequest request) {
        if (request.startDate().isAfter(request.endDate())) {
            throw new BaseException(ErrorCode.TRIP_INVALID_DATE_RANGE);
        }
    }

    @Transactional
    public TripInviteUsersResponse inviteUsers(UUID requesterUserId, UUID tripId, TripInviteUsersRequest request) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }

        if (trip.getStatus() != TripStatus.DRAFT && trip.getStatus() != TripStatus.ACTIVE) {
            throw new BaseException(ErrorCode.TRIP_INVITE_NOT_ALLOWED);
        }

        Instant now = Instant.now();
        List<UUID> invitedUserIds = new ArrayList<>();
        List<UUID> skippedUserIds = new ArrayList<>();

        LinkedHashSet<UUID> uniqueInviteeIds = new LinkedHashSet<>(request.inviteeUserIds());
        for (UUID inviteeUserId : uniqueInviteeIds) {
            if (inviteeUserId == null) {
                continue;
            }
            if (inviteeUserId.equals(requesterUserId)) {
                skippedUserIds.add(inviteeUserId);
                continue;
            }
            if (!userRepository.existsById(inviteeUserId)) {
                skippedUserIds.add(inviteeUserId);
                continue;
            }
            if (tripMemberRepository.existsByTripIdAndUserId(tripId, inviteeUserId)) {
                skippedUserIds.add(inviteeUserId);
                continue;
            }

            TripMember tripMember = TripMember.builder()
                    .tripMemberId(UUID.randomUUID())
                    .tripId(tripId)
                    .userId(inviteeUserId)
                    .inviteStatus(TripMemberInviteStatus.INVITED)
                    .invitedByUserId(requesterUserId)
                    .invitedAt(now)
                    .joinedAt(null)
                    .leftAt(null)
                    .createdAt(now)
                    .build();
            tripMemberRepository.save(tripMember);
            invitedUserIds.add(inviteeUserId);
        }

        return new TripInviteUsersResponse(invitedUserIds, skippedUserIds);
    }
}
