package com.yeoun.domain.timeline.repository;

import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID> {
    List<Event> findByTimelineDayIdOrderByStartAtAscEndAtAscCreatedAtAsc(UUID timelineDayId);

    List<Event> findByTimelineDayIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(UUID timelineDayId);

    List<Event> findByTripIdAndEventTypeOrderByStartAtAscEndAtAscCreatedAtAsc(UUID tripId, EventType eventType);

    Optional<Event> findByTripIdAndPlaceExternalId(UUID tripId, String placeExternalId);

    long countByTimelineDayId(UUID timelineDayId);

    long countByTimelineDayIdAndHiddenFalse(UUID timelineDayId);
}
