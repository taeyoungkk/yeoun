package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {

    @Query("""
            SELECT t
            FROM Trip t
            WHERE t.deletedAt IS NULL
              AND t.status <> :deletedStatus
              AND (
                    t.ownerUserId = :userId
                    OR EXISTS (
                        SELECT 1
                        FROM TripMember tm
                        WHERE tm.tripId = t.tripId
                          AND tm.userId = :userId
                          AND tm.inviteStatus = com.yeoun.domain.trip.entity.TripMemberInviteStatus.ACCEPTED
                          AND tm.leftAt IS NULL
                    )
              )
            ORDER BY t.startDate ASC, t.createdAt ASC
            """)
    List<Trip> findAccessibleTripsByUserId(@Param("userId") UUID userId, @Param("deletedStatus") TripStatus deletedStatus);

    Optional<Trip> findByTripIdAndDeletedAtIsNullAndStatusNot(UUID tripId, TripStatus deletedStatus);

    List<Trip> findByDeletedAtIsNullAndStatusAndActualEndedAtBefore(TripStatus status, Instant actualEndedAtBefore);
}
