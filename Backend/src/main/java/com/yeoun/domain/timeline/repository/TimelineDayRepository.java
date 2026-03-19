package com.yeoun.domain.timeline.repository;

import com.yeoun.domain.timeline.entity.TimelineDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TimelineDayRepository extends JpaRepository<TimelineDay, UUID> {
    List<TimelineDay> findByTripIdOrderByDayDateAsc(UUID tripId);

    Optional<TimelineDay> findByTripIdAndDayDate(UUID tripId, LocalDate dayDate);

    void deleteByTripId(UUID tripId);
}
