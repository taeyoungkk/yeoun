package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {
}
