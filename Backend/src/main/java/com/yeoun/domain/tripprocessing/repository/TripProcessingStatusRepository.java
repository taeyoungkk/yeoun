package com.yeoun.domain.tripprocessing.repository;

import com.yeoun.domain.tripprocessing.entity.TripProcessingStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TripProcessingStatusRepository extends JpaRepository<TripProcessingStatus, UUID> {
}
