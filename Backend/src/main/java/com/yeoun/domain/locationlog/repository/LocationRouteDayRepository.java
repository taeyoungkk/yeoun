package com.yeoun.domain.locationlog.repository;

import com.yeoun.domain.locationlog.entity.LocationRouteDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LocationRouteDayRepository extends JpaRepository<LocationRouteDay, UUID> {

    List<LocationRouteDay> findByTripIdOrderByDayAscUserIdAsc(UUID tripId);
}
