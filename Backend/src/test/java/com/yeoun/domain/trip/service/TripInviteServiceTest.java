package com.yeoun.domain.trip.service;

import com.yeoun.domain.notification.service.NotificationService;
import com.yeoun.domain.trip.dto.response.TripInviteAcceptResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripInvite;
import com.yeoun.domain.trip.entity.TripInviteStatus;
import com.yeoun.domain.trip.entity.TripInviteType;
import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import com.yeoun.domain.trip.repository.TripInviteRepository;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserRole;
import com.yeoun.domain.user.entity.UserStatus;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.domain.user.service.UserProfileImageUrlService;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripInviteServiceTest {

    @Mock
    private TripInviteRepository tripInviteRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private UserProfileImageUrlService userProfileImageUrlService;

    @InjectMocks
    private TripInviteService tripInviteService;

    @Test
    void acceptInvite_rejoinsTripWhenMemberPreviouslyLeft() {
        UUID tripId = UUID.randomUUID();
        UUID requesterUserId = UUID.randomUUID();
        UUID inviterUserId = UUID.randomUUID();
        UUID tripMemberId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-03-29T00:00:00Z");
        Instant leftAt = Instant.parse("2026-03-28T00:00:00Z");

        TripInvite invite = userInvite(tripId, inviterUserId, requesterUserId, createdAt);
        Trip trip = trip(tripId, inviterUserId, createdAt);
        User requester = user(requesterUserId, createdAt);
        TripMember departedMember = TripMember.builder()
                .tripMemberId(tripMemberId)
                .tripId(tripId)
                .userId(requesterUserId)
                .inviteStatus(TripMemberInviteStatus.ACCEPTED)
                .invitedByUserId(inviterUserId)
                .invitedAt(createdAt)
                .joinedAt(createdAt)
                .leftAt(leftAt)
                .createdAt(createdAt)
                .build();

        when(tripInviteRepository.findByInviteToken(invite.getInviteToken())).thenReturn(Optional.of(invite));
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(userRepository.findById(requesterUserId)).thenReturn(Optional.of(requester));
        when(tripMemberRepository.findByTripIdAndUserId(tripId, requesterUserId))
                .thenReturn(Optional.of(departedMember));

        TripInviteAcceptResponse response = tripInviteService.acceptInvite(requesterUserId, invite.getInviteToken());

        assertThat(response.tripId()).isEqualTo(tripId);
        assertThat(response.tripMemberId()).isEqualTo(tripMemberId);
        assertThat(response.inviteStatus()).isEqualTo(TripMemberInviteStatus.ACCEPTED);
        assertThat(response.joinedAt()).isNotNull();
        assertThat(departedMember.getLeftAt()).isNull();
        assertThat(invite.getStatus()).isEqualTo(TripInviteStatus.USED);
        verify(tripMemberRepository, never()).save(any());
    }

    @Test
    void acceptInvite_throwsWhenRequesterIsAlreadyCurrentMember() {
        UUID tripId = UUID.randomUUID();
        UUID requesterUserId = UUID.randomUUID();
        UUID inviterUserId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-03-29T00:00:00Z");

        TripInvite invite = userInvite(tripId, inviterUserId, requesterUserId, createdAt);
        Trip trip = trip(tripId, inviterUserId, createdAt);
        User requester = user(requesterUserId, createdAt);
        TripMember currentMember = TripMember.builder()
                .tripMemberId(UUID.randomUUID())
                .tripId(tripId)
                .userId(requesterUserId)
                .inviteStatus(TripMemberInviteStatus.ACCEPTED)
                .invitedByUserId(inviterUserId)
                .invitedAt(createdAt)
                .joinedAt(createdAt)
                .leftAt(null)
                .createdAt(createdAt)
                .build();

        when(tripInviteRepository.findByInviteToken(invite.getInviteToken())).thenReturn(Optional.of(invite));
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(userRepository.findById(requesterUserId)).thenReturn(Optional.of(requester));
        when(tripMemberRepository.findByTripIdAndUserId(tripId, requesterUserId))
                .thenReturn(Optional.of(currentMember));

        assertThatThrownBy(() -> tripInviteService.acceptInvite(requesterUserId, invite.getInviteToken()))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.TRIP_ALREADY_MEMBER);

        assertThat(invite.getStatus()).isEqualTo(TripInviteStatus.SENT);
        verify(tripMemberRepository, never()).save(any());
    }

    @Test
    void acceptInvite_createsMemberWhenPreviousInviteWasOnlyDeclined() {
        UUID tripId = UUID.randomUUID();
        UUID requesterUserId = UUID.randomUUID();
        UUID inviterUserId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-03-29T00:00:00Z");
        UUID firstInviteId = UUID.randomUUID();
        UUID secondInviteId = UUID.randomUUID();

        TripInvite declinedInvite = TripInvite.builder()
                .tripInviteId(firstInviteId)
                .tripId(tripId)
                .inviterUserId(inviterUserId)
                .inviteType(TripInviteType.USER)
                .inviteToken("declined-" + UUID.randomUUID())
                .expiresAt(createdAt.plusSeconds(86400))
                .status(TripInviteStatus.SENT)
                .targetUserId(requesterUserId)
                .createdAt(createdAt)
                .usedAt(null)
                .build();
        TripInvite reinvite = userInvite(tripId, inviterUserId, requesterUserId, createdAt.plusSeconds(60));
        Trip trip = trip(tripId, inviterUserId, createdAt);
        User requester = user(requesterUserId, createdAt);

        when(userRepository.findById(requesterUserId)).thenReturn(Optional.of(requester));
        when(tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                tripId,
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        )).thenReturn(false);
        when(tripInviteRepository.findById(firstInviteId)).thenReturn(Optional.of(declinedInvite));
        when(tripInviteRepository.findByInviteToken(reinvite.getInviteToken())).thenReturn(Optional.of(reinvite));
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(tripMemberRepository.findByTripIdAndUserId(tripId, requesterUserId))
                .thenReturn(Optional.empty());

        tripInviteService.declineInviteById(requesterUserId, firstInviteId);
        TripInviteAcceptResponse response = tripInviteService.acceptInvite(requesterUserId, reinvite.getInviteToken());

        assertThat(declinedInvite.getStatus()).isEqualTo(TripInviteStatus.CANCELLED);
        assertThat(reinvite.getStatus()).isEqualTo(TripInviteStatus.USED);
        assertThat(response.tripId()).isEqualTo(tripId);
        assertThat(response.inviteStatus()).isEqualTo(TripMemberInviteStatus.ACCEPTED);
        verify(tripMemberRepository).save(any(TripMember.class));
    }

    @Test
    void acceptInvite_throwsExpiredWhenInviteIsPastExpiry() {
        UUID tripId = UUID.randomUUID();
        UUID requesterUserId = UUID.randomUUID();
        UUID inviterUserId = UUID.randomUUID();
        Instant createdAt = Instant.now().minusSeconds(172800);

        TripInvite invite = TripInvite.builder()
                .tripInviteId(UUID.randomUUID())
                .tripId(tripId)
                .inviterUserId(inviterUserId)
                .inviteType(TripInviteType.USER)
                .inviteToken("expired-" + UUID.randomUUID())
                .expiresAt(Instant.now().minusSeconds(60))
                .status(TripInviteStatus.SENT)
                .targetUserId(requesterUserId)
                .createdAt(createdAt)
                .usedAt(null)
                .build();

        when(tripInviteRepository.findByInviteToken(invite.getInviteToken())).thenReturn(Optional.of(invite));

        assertThatThrownBy(() -> tripInviteService.acceptInvite(requesterUserId, invite.getInviteToken()))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.TRIP_INVITE_EXPIRED);

        assertThat(invite.getStatus()).isEqualTo(TripInviteStatus.EXPIRED);
    }

    @Test
    void acceptInvite_throwsAlreadyProcessedWhenInviteWasCancelled() {
        UUID tripId = UUID.randomUUID();
        UUID requesterUserId = UUID.randomUUID();
        UUID inviterUserId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-03-29T00:00:00Z");

        TripInvite invite = TripInvite.builder()
                .tripInviteId(UUID.randomUUID())
                .tripId(tripId)
                .inviterUserId(inviterUserId)
                .inviteType(TripInviteType.USER)
                .inviteToken("cancelled-" + UUID.randomUUID())
                .expiresAt(createdAt.plusSeconds(86400))
                .status(TripInviteStatus.CANCELLED)
                .targetUserId(requesterUserId)
                .createdAt(createdAt)
                .usedAt(null)
                .build();

        when(tripInviteRepository.findByInviteToken(invite.getInviteToken())).thenReturn(Optional.of(invite));

        assertThatThrownBy(() -> tripInviteService.acceptInvite(requesterUserId, invite.getInviteToken()))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.TRIP_INVITE_ALREADY_PROCESSED);
    }

    private TripInvite userInvite(UUID tripId, UUID inviterUserId, UUID targetUserId, Instant createdAt) {
        return TripInvite.builder()
                .tripInviteId(UUID.randomUUID())
                .tripId(tripId)
                .inviterUserId(inviterUserId)
                .inviteType(TripInviteType.USER)
                .inviteToken("invite-token-" + UUID.randomUUID())
                .expiresAt(createdAt.plusSeconds(86400))
                .status(TripInviteStatus.SENT)
                .targetUserId(targetUserId)
                .createdAt(createdAt)
                .usedAt(null)
                .build();
    }

    private Trip trip(UUID tripId, UUID ownerUserId, Instant now) {
        return Trip.builder()
                .tripId(tripId)
                .ownerUserId(ownerUserId)
                .title("Trip")
                .startDate(LocalDate.of(2026, 3, 29))
                .endDate(LocalDate.of(2026, 3, 30))
                .status(TripStatus.ACTIVE)
                .visibility(TripVisibility.PRIVATE)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private User user(UUID userId, Instant now) {
        return User.builder()
                .userId(userId)
                .email(userId + "@example.com")
                .nickname("user-" + userId.toString().substring(0, 8))
                .timezone("Asia/Seoul")
                .status(UserStatus.ACTIVE)
                .role(UserRole.USER)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
