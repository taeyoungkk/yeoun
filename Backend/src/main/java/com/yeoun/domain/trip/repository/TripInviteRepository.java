package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripInvite;
import com.yeoun.domain.trip.entity.TripInviteType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TripInviteRepository extends JpaRepository<TripInvite, UUID> {
    Optional<TripInvite> findByInviteToken(String inviteToken);

    Optional<TripInvite> findTopByTripIdAndInviteTypeOrderByCreatedAtDesc(UUID tripId, TripInviteType inviteType);

    boolean existsByInviteToken(String inviteToken);
}
