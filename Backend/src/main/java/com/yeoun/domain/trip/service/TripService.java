package com.yeoun.domain.trip.service;

import com.yeoun.domain.trip.dto.request.TripCreateRequest;
import com.yeoun.domain.trip.dto.request.TripInviteUsersRequest;
import com.yeoun.domain.trip.dto.request.TripUpdateRequest;
import com.yeoun.domain.trip.dto.response.TripCreateResponse;
import com.yeoun.domain.trip.dto.response.TripDeleteResponse;
import com.yeoun.domain.trip.dto.response.TripDetailResponse;
import com.yeoun.domain.trip.dto.response.TripInviteUsersResponse;
import com.yeoun.domain.trip.dto.response.TripInviteLinkCreateResponse;
import com.yeoun.domain.trip.dto.response.TripListItemResponse;
import com.yeoun.domain.trip.dto.response.TripListResponse;
import com.yeoun.domain.trip.dto.response.TripLeaveResponse;
import com.yeoun.domain.trip.dto.response.TripMemberItemResponse;
import com.yeoun.domain.trip.dto.response.TripMemberListResponse;
import com.yeoun.domain.trip.dto.response.TripEndResponse;
import com.yeoun.domain.trip.dto.response.TripStartResponse;
import com.yeoun.domain.trip.dto.response.TripUpdateResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripInvite;
import com.yeoun.domain.trip.entity.TripInviteStatus;
import com.yeoun.domain.trip.entity.TripInviteType;
import com.yeoun.domain.trip.entity.TripReportStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import com.yeoun.domain.trip.repository.TripMemberCountProjection;
import com.yeoun.domain.trip.repository.TripInviteRepository;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.trip.repository.TripMemberSummaryProjection;
import com.yeoun.domain.trip.repository.TripInviteUserSummaryProjection;
import com.yeoun.domain.tripsync.entity.SyncStatus;
import com.yeoun.domain.tripsync.entity.TripSyncStatus;
import com.yeoun.domain.tripsync.repository.TripSyncStatusRepository;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.domain.notification.entity.NotificationType;
import com.yeoun.domain.notification.service.NotificationService;
import com.yeoun.domain.user.entity.User;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
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

    private static final long LINK_INVITE_EXPIRE_DAYS = 7L;

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final TripInviteRepository tripInviteRepository;
    private final UserRepository userRepository;
    private final TripSyncStatusRepository tripSyncStatusRepository;
    private final NotificationService notificationService;
    private final String inviteBaseUrl;

    public TripService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            TripInviteRepository tripInviteRepository,
            UserRepository userRepository,
            TripSyncStatusRepository tripSyncStatusRepository,
            NotificationService notificationService,
            @Value("${app.invite.base-url}") String inviteBaseUrl
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.tripInviteRepository = tripInviteRepository;
        this.userRepository = userRepository;
        this.tripSyncStatusRepository = tripSyncStatusRepository;
        this.notificationService = notificationService;
        this.inviteBaseUrl = inviteBaseUrl;
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

        TripSyncStatus tripSyncStatus = TripSyncStatus.builder()
                .tripId(trip.getTripId())
                .syncStatus(SyncStatus.IDLE)
                .routeVersion(0L)
                .timelineVersion(0L)
                .photoVersion(0L)
                .pendingPhotoCount(0)
                .pendingLocationCount(0)
                .lastErrorMessage(null)
                .createdAt(now)
                .updatedAt(now)
                .build();
        tripSyncStatusRepository.save(tripSyncStatus);

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
        Trip trip = findNonDeletedTripOrThrow(tripId);

        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }

        if (!isInviteAllowedStatus(trip.getStatus())) {
            throw new BaseException(ErrorCode.TRIP_INVITE_NOT_ALLOWED);
        }

        User inviter = userRepository.findById(requesterUserId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(LINK_INVITE_EXPIRE_DAYS * 24 * 60 * 60);
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
            TripMember existingMember = tripMemberRepository.findByTripIdAndUserId(tripId, inviteeUserId).orElse(null);
            if (existingMember != null
                    && existingMember.getInviteStatus() == TripMemberInviteStatus.ACCEPTED
                    && existingMember.getLeftAt() == null) {
                skippedUserIds.add(inviteeUserId);
                continue;
            }

            TripInvite existingInvite = tripInviteRepository
                    .findTopByTripIdAndInviteTypeAndTargetUserIdAndStatusOrderByCreatedAtDesc(
                            tripId,
                            TripInviteType.USER,
                            inviteeUserId,
                            TripInviteStatus.SENT
                    )
                    .orElse(null);
            if (existingInvite != null) {
                if (existingInvite.getExpiresAt().isAfter(now)) {
                    skippedUserIds.add(inviteeUserId);
                    continue;
                }
                existingInvite.markExpired();
            }

            TripInvite tripInvite = TripInvite.builder()
                    .tripInviteId(UUID.randomUUID())
                    .tripId(tripId)
                    .inviterUserId(requesterUserId)
                    .inviteType(TripInviteType.USER)
                    .inviteToken(generateUniqueInviteToken())
                    .expiresAt(expiresAt)
                    .status(TripInviteStatus.SENT)
                    .targetUserId(inviteeUserId)
                    .createdAt(now)
                    .usedAt(null)
                    .build();
            tripInviteRepository.save(tripInvite);
            notificationService.createNotification(
                    inviteeUserId,
                    requesterUserId,
                    tripId,
                    tripInvite.getTripInviteId(),
                    NotificationType.TRIP_INVITE_RECEIVED,
                    "여행 초대가 도착했어요",
                    inviter.getNickname() + "님이 \"" + trip.getTitle() + "\" 여행에 초대했습니다."
            );
            invitedUserIds.add(inviteeUserId);
        }

        return new TripInviteUsersResponse(invitedUserIds, skippedUserIds);
    }

    @Transactional
    public TripInviteLinkCreateResponse createLinkInvite(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripOwner(requesterUserId, trip);

        if (!isInviteAllowedStatus(trip.getStatus())) {
            throw new BaseException(ErrorCode.TRIP_INVITE_NOT_ALLOWED);
        }

        Instant now = Instant.now();
        Instant nextExpiresAt = now.plusSeconds(LINK_INVITE_EXPIRE_DAYS * 24 * 60 * 60);

        TripInvite invite = tripInviteRepository
                .findTopByTripIdAndInviteTypeOrderByCreatedAtDesc(tripId, TripInviteType.LINK)
                .orElse(null);

        if (invite != null) {
            if (invite.getStatus() == TripInviteStatus.SENT && invite.getExpiresAt().isAfter(now)) {
                invite.extendExpiresAt(nextExpiresAt);
                return toLinkInviteResponse(invite);
            }
            if (invite.getStatus() == TripInviteStatus.SENT && !invite.getExpiresAt().isAfter(now)) {
                invite.markExpired();
            }
        }

        TripInvite newInvite = TripInvite.builder()
                .tripInviteId(UUID.randomUUID())
                .tripId(tripId)
                .inviterUserId(requesterUserId)
                .inviteType(TripInviteType.LINK)
                .inviteToken(generateUniqueInviteToken())
                .expiresAt(nextExpiresAt)
                .status(TripInviteStatus.SENT)
                .targetUserId(null)
                .createdAt(now)
                .usedAt(null)
                .build();
        tripInviteRepository.save(newInvite);

        return toLinkInviteResponse(newInvite);
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
                        trip.getStartedAt(),
                        trip.getActualEndedAt(),
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
                trip.getStartedAt(),
                trip.getActualEndedAt(),
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

        List<TripMemberItemResponse> items = new ArrayList<>();

        items.addAll(tripMemberRepository.findVisibleMembersByTripId(tripId).stream()
                .map(member -> new TripMemberItemResponse(
                        null,
                        member.getTripMemberId(),
                        member.getUserId(),
                        member.getNickname(),
                        member.getProfileImageUrl(),
                        member.getInviteStatus(),
                        member.getJoinedAt()
                ))
                .toList());

        items.addAll(tripInviteRepository.findVisibleUserInvitesByTripId(tripId, Instant.now()).stream()
                .map(invite -> new TripMemberItemResponse(
                        invite.getTripInviteId(),
                        null,
                        invite.getUserId(),
                        invite.getNickname(),
                        invite.getProfileImageUrl(),
                        TripMemberInviteStatus.INVITED,
                        null
                ))
                .toList());

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
        tripMemberRepository.findByTripIdAndInviteStatusAndLeftAtIsNull(
                        tripId,
                        TripMemberInviteStatus.ACCEPTED
                )
                .forEach(member -> member.initializePhotoSyncCursor(now));

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

    @Transactional
    public TripLeaveResponse leaveTrip(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        if (!isLeaveAllowedStatus(trip.getStatus())) {
            throw new BaseException(ErrorCode.TRIP_LEAVE_NOT_ALLOWED);
        }
        if (trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_LEAVE_NOT_ALLOWED);
        }

        TripMember tripMember = tripMemberRepository.findByTripIdAndUserId(tripId, requesterUserId)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_FORBIDDEN));

        if (tripMember.getInviteStatus() != TripMemberInviteStatus.ACCEPTED || tripMember.getLeftAt() != null) {
            throw new BaseException(ErrorCode.TRIP_LEAVE_NOT_ALLOWED);
        }

        Instant now = Instant.now();
        tripMember.leave(now);

        return new TripLeaveResponse(tripId, true, tripMember.getLeftAt());
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

    private boolean isInviteAllowedStatus(TripStatus status) {
        return status == TripStatus.DRAFT || status == TripStatus.ACTIVE;
    }

    private boolean isLeaveAllowedStatus(TripStatus status) {
        return status == TripStatus.DRAFT || status == TripStatus.ACTIVE;
    }

    private String generateUniqueInviteToken() {
        for (int i = 0; i < 5; i++) {
            String token = UUID.randomUUID().toString().replace("-", "");
            if (!tripInviteRepository.existsByInviteToken(token)) {
                return token;
            }
        }
        throw new BaseException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    private TripInviteLinkCreateResponse toLinkInviteResponse(TripInvite invite) {
        String normalizedBaseUrl = inviteBaseUrl.endsWith("/")
                ? inviteBaseUrl.substring(0, inviteBaseUrl.length() - 1)
                : inviteBaseUrl;
        return new TripInviteLinkCreateResponse(
                invite.getTripInviteId(),
                invite.getInviteType(),
                invite.getInviteToken(),
                normalizedBaseUrl + "/" + invite.getInviteToken(),
                invite.getExpiresAt()
        );
    }
}
