package com.yeoun.domain.locationlog.repository;

import com.yeoun.domain.locationlog.entity.LocationLogRaw;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface LocationLogRawRepository extends JpaRepository<LocationLogRaw, UUID> {

    // 이번 batch에 포함된 UUID 중 이미 저장된 raw 로그를 한 번에 찾는다.
    List<LocationLogRaw> findByTripIdAndUserIdAndClientLogUuidIn(UUID tripId, UUID userId, Collection<String> clientLogUuids);

    long deleteByTripIdIn(Collection<UUID> tripIds);
}
