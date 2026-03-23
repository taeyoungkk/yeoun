package com.yeoun.domain.locationlog.repository;

import com.yeoun.domain.locationlog.entity.LocationPlace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LocationPlaceRepository extends JpaRepository<LocationPlace, UUID> {

    List<LocationPlace> findByTripIdOrderByStartedAtAscUserIdAsc(UUID tripId);
}
