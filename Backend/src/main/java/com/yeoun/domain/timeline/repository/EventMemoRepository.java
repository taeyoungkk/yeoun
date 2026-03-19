package com.yeoun.domain.timeline.repository;

import com.yeoun.domain.timeline.entity.EventMemo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EventMemoRepository extends JpaRepository<EventMemo, UUID> {
    Optional<EventMemo> findByEventIdAndUserId(UUID eventId, UUID userId);
}
