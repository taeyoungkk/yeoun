package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripInvite;
import com.yeoun.domain.trip.entity.TripInviteStatus;
import com.yeoun.domain.trip.entity.TripInviteType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripInviteRepository extends JpaRepository<TripInvite, UUID> {
    Optional<TripInvite> findByInviteToken(String inviteToken);

    Optional<TripInvite> findTopByTripIdAndInviteTypeOrderByCreatedAtDesc(UUID tripId, TripInviteType inviteType);

    Optional<TripInvite> findTopByTripIdAndInviteTypeAndTargetUserIdAndStatusOrderByCreatedAtDesc(
            UUID tripId,
            TripInviteType inviteType,
            UUID targetUserId,
            TripInviteStatus status
    );

    boolean existsByInviteToken(String inviteToken);

    @Query("""
            SELECT ti.tripInviteId AS tripInviteId,
                   ti.targetUserId AS userId,
                   u.nickname AS nickname,
                   u.profileImageUrl AS profileImageUrl
            FROM TripInvite ti
            JOIN User u ON u.userId = ti.targetUserId
            WHERE ti.tripId = :tripId
              AND ti.inviteType = com.yeoun.domain.trip.entity.TripInviteType.USER
              AND ti.status = com.yeoun.domain.trip.entity.TripInviteStatus.SENT
              AND ti.expiresAt > :now
            ORDER BY u.nickname ASC
            """)
    List<TripInviteUserSummaryProjection> findVisibleUserInvitesByTripId(@Param("tripId") UUID tripId, @Param("now") Instant now);

    @Query("""
            SELECT ti.tripInviteId AS tripInviteId,
                   ti.inviteToken AS inviteToken,
                   t.tripId AS tripId,
                   t.title AS tripTitle,
                   inviter.userId AS inviterUserId,
                   inviter.nickname AS inviterNickname,
                   inviter.profileImageUrl AS inviterProfileImageUrl,
                   ti.status AS status,
                   ti.expiresAt AS expiresAt,
                   ti.createdAt AS createdAt
            FROM TripInvite ti
            JOIN Trip t ON t.tripId = ti.tripId
            JOIN User inviter ON inviter.userId = ti.inviterUserId
            WHERE ti.targetUserId = :userId
              AND ti.inviteType = com.yeoun.domain.trip.entity.TripInviteType.USER
              AND ti.status = com.yeoun.domain.trip.entity.TripInviteStatus.SENT
              AND ti.expiresAt > :now
              AND t.deletedAt IS NULL
              AND t.status <> com.yeoun.domain.trip.entity.TripStatus.DELETED
            ORDER BY ti.createdAt DESC
            """)
    List<ReceivedTripInviteSummaryProjection> findReceivedUserInvites(@Param("userId") UUID userId, @Param("now") Instant now);
}
