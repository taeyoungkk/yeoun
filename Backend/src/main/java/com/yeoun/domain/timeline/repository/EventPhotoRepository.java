package com.yeoun.domain.timeline.repository;

import com.yeoun.domain.timeline.entity.EventPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EventPhotoRepository extends JpaRepository<EventPhoto, UUID> {
    List<EventPhoto> findByEventIdOrderBySortOrderAsc(UUID eventId);

    List<EventPhoto> findByEventIdInOrderByEventIdAscSortOrderAsc(List<UUID> eventIds);

    List<EventPhoto> findByPhotoIdIn(List<UUID> photoIds);

    void deleteByEventId(UUID eventId);

    long countByEventId(UUID eventId);

    long countByEventIdIn(List<UUID> eventIds);
}
