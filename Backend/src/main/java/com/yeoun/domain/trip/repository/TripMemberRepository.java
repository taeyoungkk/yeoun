package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {
    boolean existsByTripIdAndUserId(UUID tripId, UUID userId);

    Optional<TripMember> findByTripIdAndUserId(UUID tripId, UUID userId);

    Optional<TripMember> findByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
            UUID tripId,
            UUID userId,
            TripMemberInviteStatus inviteStatus
    );

    boolean existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
            UUID tripId,
            UUID userId,
            TripMemberInviteStatus inviteStatus
    );

    long countByTripIdAndInviteStatusAndLeftAtIsNull(UUID tripId, TripMemberInviteStatus inviteStatus);

    @Query("""
            SELECT tm.tripId AS tripId, COUNT(tm) AS memberCount
            FROM TripMember tm
            WHERE tm.tripId IN :tripIds
              AND tm.inviteStatus = com.yeoun.domain.trip.entity.TripMemberInviteStatus.ACCEPTED
              AND tm.leftAt IS NULL
            GROUP BY tm.tripId
            """)
    List<TripMemberCountProjection> countCurrentMembersByTripIds(@Param("tripIds") Collection<UUID> tripIds);

    @Query("""
            SELECT tm.tripMemberId AS tripMemberId,
                   tm.userId AS userId,
                   u.nickname AS nickname,
                   u.profileImageUrl AS profileImageUrl,
                   tm.inviteStatus AS inviteStatus,
                   tm.joinedAt AS joinedAt
            FROM TripMember tm
            JOIN User u ON u.userId = tm.userId
            WHERE tm.tripId = :tripId
              AND tm.leftAt IS NULL
              AND tm.inviteStatus = com.yeoun.domain.trip.entity.TripMemberInviteStatus.ACCEPTED
            ORDER BY u.nickname ASC
            """)
    List<TripMemberSummaryProjection> findVisibleMembersByTripId(@Param("tripId") UUID tripId);
}
