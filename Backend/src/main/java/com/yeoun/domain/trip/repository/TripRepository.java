package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {
}
