package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {
    boolean existsByTripIdAndUserId(UUID tripId, UUID userId);

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
}
