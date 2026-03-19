package com.yeoun.domain.timeline.repository;

import com.yeoun.domain.timeline.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID> {
    List<Event> findByTimelineDayIdOrderByStartAtAscEndAtAscCreatedAtAsc(UUID timelineDayId);

    List<Event> findByTimelineDayIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(UUID timelineDayId);

    long countByTimelineDayId(UUID timelineDayId);

    long countByTimelineDayIdAndHiddenFalse(UUID timelineDayId);
}
