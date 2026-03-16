package com.yeoun.domain.trip.service;

import com.yeoun.domain.trip.dto.request.TripCreateRequest;
import com.yeoun.domain.trip.dto.request.TripInviteUsersRequest;
import com.yeoun.domain.trip.dto.request.TripUpdateRequest;
import com.yeoun.domain.trip.dto.response.TripCreateResponse;
import com.yeoun.domain.trip.dto.response.TripDeleteResponse;
import com.yeoun.domain.trip.dto.response.TripDetailResponse;
import com.yeoun.domain.trip.dto.response.TripInviteUsersResponse;
import com.yeoun.domain.trip.dto.response.TripListItemResponse;
import com.yeoun.domain.trip.dto.response.TripListResponse;
import com.yeoun.domain.trip.dto.response.TripMemberItemResponse;
import com.yeoun.domain.trip.dto.response.TripMemberListResponse;
import com.yeoun.domain.trip.dto.response.TripEndResponse;
import com.yeoun.domain.trip.dto.response.TripStartResponse;
import com.yeoun.domain.trip.dto.response.TripUpdateResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripReportStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import com.yeoun.domain.trip.repository.TripMemberCountProjection;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.trip.repository.TripMemberSummaryProjection;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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

    public TripListResponse getTrips(UUID userId) {
        List<Trip> trips = tripRepository.findAccessibleTripsByUserId(userId, TripStatus.DELETED);
        if (trips.isEmpty()) {
            return new TripListResponse(List.of());
        }

        List<UUID> tripIds = trips.stream().map(Trip::getTripId).toList();
        Map<UUID, Long> memberCountByTripId = buildMemberCountMap(tripIds);

        List<TripListItemResponse> items = trips.stream()
                .map(trip -> new TripListItemResponse(
                        trip.getTripId(),
                        trip.getTitle(),
                        trip.getStartDate(),
                        trip.getEndDate(),
                        trip.getStatus(),
                        memberCountByTripId.getOrDefault(trip.getTripId(), 0L)
                ))
                .toList();

        return new TripListResponse(items);
    }

    public TripDetailResponse getTripDetail(UUID userId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);

        validateTripAccessible(userId, trip);

        long memberCount = tripMemberRepository.countByTripIdAndInviteStatusAndLeftAtIsNull(
                tripId,
                TripMemberInviteStatus.ACCEPTED
        );

        return new TripDetailResponse(
                trip.getTripId(),
                trip.getTitle(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getStatus(),
                trip.getVisibility(),
                trip.getOwnerUserId(),
                trip.getReportStatus(),
                memberCount,
                trip.getCreatedAt()
        );
    }

    public TripMemberListResponse getTripMembers(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);

        List<TripMemberItemResponse> items = tripMemberRepository.findVisibleMembersByTripId(tripId).stream()
                .map(member -> new TripMemberItemResponse(
                        member.getTripMemberId(),
                        member.getUserId(),
                        member.getNickname(),
                        member.getProfileImageUrl(),
                        member.getInviteStatus(),
                        member.getJoinedAt()
                ))
                .toList();

        return new TripMemberListResponse(items);
    }

    @Transactional
    public TripUpdateResponse updateTrip(UUID requesterUserId, UUID tripId, TripUpdateRequest request) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripOwner(requesterUserId, trip);

        if (trip.getStatus() != TripStatus.DRAFT && trip.getStatus() != TripStatus.ACTIVE) {
            throw new BaseException(ErrorCode.TRIP_UPDATE_NOT_ALLOWED);
        }

        String title = trip.getTitle();
        if (request.title() != null) {
            String trimmed = request.title().trim();
            if (trimmed.isEmpty()) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
            }
            title = trimmed;
        }

        java.time.LocalDate startDate = request.startDate() == null ? trip.getStartDate() : request.startDate();
        java.time.LocalDate endDate = request.endDate() == null ? trip.getEndDate() : request.endDate();
        TripVisibility visibility = request.visibility() == null ? trip.getVisibility() : request.visibility();

        if (startDate.isAfter(endDate)) {
            throw new BaseException(ErrorCode.TRIP_INVALID_DATE_RANGE);
        }

        Instant now = Instant.now();
        trip.updateBasicInfo(title, startDate, endDate, visibility, now);

        return new TripUpdateResponse(
                trip.getTripId(),
                trip.getTitle(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getVisibility(),
                trip.getUpdatedAt()
        );
    }

    @Transactional
    public TripDeleteResponse deleteTrip(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripOwner(requesterUserId, trip);

        trip.markDeleted(Instant.now());

        return new TripDeleteResponse(trip.getTripId(), true);
    }

    @Transactional
    public TripStartResponse startTrip(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripOwner(requesterUserId, trip);

        if (trip.getStatus() != TripStatus.DRAFT) {
            throw new BaseException(ErrorCode.TRIP_START_NOT_ALLOWED);
        }

        Instant now = Instant.now();
        trip.markStarted(now);

        return new TripStartResponse(
                trip.getTripId(),
                trip.getStatus(),
                trip.getStartedAt()
        );
    }

    @Transactional
    public TripEndResponse endTrip(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripOwner(requesterUserId, trip);

        if (trip.getStatus() != TripStatus.ACTIVE) {
            throw new BaseException(ErrorCode.TRIP_END_NOT_ALLOWED);
        }

        Instant now = Instant.now();
        trip.markEnded(now);

        return new TripEndResponse(
                trip.getTripId(),
                trip.getStatus(),
                trip.getActualEndedAt()
        );
    }

    private Map<UUID, Long> buildMemberCountMap(List<UUID> tripIds) {
        Map<UUID, Long> memberCountByTripId = new HashMap<>();
        List<TripMemberCountProjection> counts = tripMemberRepository.countCurrentMembersByTripIds(tripIds);
        for (TripMemberCountProjection count : counts) {
            memberCountByTripId.put(count.getTripId(), count.getMemberCount());
        }
        return memberCountByTripId;
    }

    private Trip findNonDeletedTripOrThrow(UUID tripId) {
        return tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
    }

    private void validateTripOwner(UUID requesterUserId, Trip trip) {
        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
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
