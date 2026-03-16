package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripInvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TripInviteRepository extends JpaRepository<TripInvite, UUID> {
    Optional<TripInvite> findByInviteToken(String inviteToken);
}
