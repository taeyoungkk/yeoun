package com.yeoun.domain.tripsync.repository;

import com.yeoun.domain.tripsync.entity.TripSyncStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TripSyncStatusRepository extends JpaRepository<TripSyncStatus, UUID> {
}
