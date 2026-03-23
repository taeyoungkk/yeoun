package com.yeoun.domain.locationlog.repository;

import com.yeoun.domain.locationlog.entity.LocationLogClean;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.UUID;

public interface LocationLogCleanRepository extends JpaRepository<LocationLogClean, UUID> {

    long deleteByTripIdIn(Collection<UUID> tripIds);
}
