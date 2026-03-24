package com.yeoun.domain.trip.service;

import com.yeoun.domain.trip.dto.response.TripInviteDetailResponse;
import com.yeoun.domain.trip.dto.response.TripInviteAcceptResponse;
import com.yeoun.domain.trip.dto.response.TripInviteDeclineResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripInvite;
import com.yeoun.domain.trip.entity.TripInviteStatus;
import com.yeoun.domain.trip.entity.TripInviteType;
import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripInviteRepository;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.notification.entity.NotificationType;
import com.yeoun.domain.notification.service.NotificationService;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TripInviteService {

    private final TripInviteRepository tripInviteRepository;
    private final TripMemberRepository tripMemberRepository;
    private final TripRepository tripRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public TripInviteService(
            TripInviteRepository tripInviteRepository,
            TripMemberRepository tripMemberRepository,
            TripRepository tripRepository,
            UserRepository userRepository,
            NotificationService notificationService
    ) {
        this.tripInviteRepository = tripInviteRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public TripInviteDetailResponse getInviteDetail(String inviteToken) {
        TripInvite invite = tripInviteRepository.findByInviteToken(inviteToken)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_INVITE_NOT_FOUND));

        if (invite.getStatus() == TripInviteStatus.SENT && invite.getExpiresAt().isBefore(Instant.now())) {
            invite.markExpired();
        }

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(invite.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        User inviter = userRepository.findById(invite.getInviterUserId())
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        return new TripInviteDetailResponse(
                trip.getTripId(),
                trip.getTitle(),
                new TripInviteDetailResponse.Inviter(inviter.getUserId(), inviter.getNickname()),
                invite.getStatus(),
                invite.getExpiresAt()
        );
    }

    @Transactional
    public TripInviteAcceptResponse acceptInvite(UUID requesterUserId, String inviteToken) {
        TripInvite invite = tripInviteRepository.findByInviteToken(inviteToken)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_INVITE_NOT_FOUND));
        return acceptInvite(requesterUserId, invite);
    }

    @Transactional
    public TripInviteAcceptResponse acceptInviteById(UUID requesterUserId, UUID tripInviteId) {
        TripInvite invite = tripInviteRepository.findById(tripInviteId)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_INVITE_NOT_FOUND));
        return acceptInvite(requesterUserId, invite);
    }

    private TripInviteAcceptResponse acceptInvite(UUID requesterUserId, TripInvite invite) {
        Instant now = Instant.now();
        if (invite.getStatus() != TripInviteStatus.SENT) {
            throw new BaseException(ErrorCode.TRIP_INVITE_ACCEPT_NOT_ALLOWED);
        }
        if (invite.getExpiresAt().isBefore(now)) {
            invite.markExpired();
            throw new BaseException(ErrorCode.TRIP_INVITE_ACCEPT_NOT_ALLOWED);
        }
        if (invite.getInviteType() == TripInviteType.USER
                && invite.getTargetUserId() != null
                && !invite.getTargetUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(invite.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
        if (!isInviteAcceptAllowedStatus(trip.getStatus())) {
            throw new BaseException(ErrorCode.TRIP_INVITE_ACCEPT_NOT_ALLOWED);
        }
        User requester = userRepository.findById(requesterUserId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        TripMember tripMember = tripMemberRepository.findByTripIdAndUserId(trip.getTripId(), requesterUserId)
                .orElse(null);

        if (tripMember != null) {
            if (tripMember.getInviteStatus() == TripMemberInviteStatus.ACCEPTED && tripMember.getLeftAt() == null) {
                throw new BaseException(ErrorCode.TRIP_ALREADY_MEMBER);
            }
            if (tripMember.getLeftAt() != null) {
                throw new BaseException(ErrorCode.TRIP_INVITE_ACCEPT_NOT_ALLOWED);
            }
            tripMember.accept(now, invite.getInviterUserId());
        } else {
            tripMember = TripMember.builder()
                    .tripMemberId(UUID.randomUUID())
                    .tripId(trip.getTripId())
                    .userId(requesterUserId)
                    .inviteStatus(TripMemberInviteStatus.ACCEPTED)
                    .invitedByUserId(invite.getInviterUserId())
                    .invitedAt(now)
                    .joinedAt(now)
                    .leftAt(null)
                    .createdAt(now)
                    .build();
            tripMemberRepository.save(tripMember);
        }

        if (invite.getInviteType() == TripInviteType.USER) {
            invite.markUsed(now);
        }

        if (!invite.getInviterUserId().equals(requesterUserId)) {
            notificationService.createNotification(
                    invite.getInviterUserId(),
                    requesterUserId,
                    invite.getTripId(),
                    invite.getTripInviteId(),
                    NotificationType.TRIP_INVITE_ACCEPTED,
                    "여행 초대가 수락되었어요",
                    requester.getNickname() + "님이 \"" + trip.getTitle() + "\" 여행 초대를 수락했습니다."
            );
        }

        return new TripInviteAcceptResponse(
                trip.getTripId(),
                tripMember.getTripMemberId(),
                tripMember.getInviteStatus(),
                tripMember.getJoinedAt()
        );
    }

    @Transactional
    public TripInviteDeclineResponse declineInvite(UUID requesterUserId, String inviteToken) {
        TripInvite invite = tripInviteRepository.findByInviteToken(inviteToken)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_INVITE_NOT_FOUND));
        return declineInvite(requesterUserId, invite);
    }

    @Transactional
    public TripInviteDeclineResponse declineInviteById(UUID requesterUserId, UUID tripInviteId) {
        TripInvite invite = tripInviteRepository.findById(tripInviteId)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_INVITE_NOT_FOUND));
        return declineInvite(requesterUserId, invite);
    }

    private TripInviteDeclineResponse declineInvite(UUID requesterUserId, TripInvite invite) {
        Instant now = Instant.now();
        User requester = userRepository.findById(requesterUserId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                invite.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_ALREADY_MEMBER);
        }

        if (invite.getStatus() == TripInviteStatus.SENT && invite.getExpiresAt().isBefore(now)) {
            invite.markExpired();
        }
        if (invite.getStatus() != TripInviteStatus.SENT) {
            throw new BaseException(ErrorCode.TRIP_INVITE_ACCEPT_NOT_ALLOWED);
        }

        if (invite.getInviteType() == TripInviteType.USER) {
            if (invite.getTargetUserId() != null && !invite.getTargetUserId().equals(requesterUserId)) {
                throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
            }
            invite.markCancelled();
            if (!invite.getInviterUserId().equals(requesterUserId)) {
                Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(invite.getTripId(), TripStatus.DELETED)
                        .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
                notificationService.createNotification(
                        invite.getInviterUserId(),
                        requesterUserId,
                        invite.getTripId(),
                        invite.getTripInviteId(),
                        NotificationType.TRIP_INVITE_DECLINED,
                        "여행 초대가 거절되었어요",
                        requester.getNickname() + "님이 \"" + trip.getTitle() + "\" 여행 초대를 거절했습니다."
                );
            }
            return new TripInviteDeclineResponse(invite.getTripId(), TripInviteStatus.CANCELLED.name());
        }

        return new TripInviteDeclineResponse(invite.getTripId(), "DECLINED");
    }

    private boolean isInviteAcceptAllowedStatus(TripStatus status) {
        return status == TripStatus.DRAFT || status == TripStatus.ACTIVE;
    }
}
