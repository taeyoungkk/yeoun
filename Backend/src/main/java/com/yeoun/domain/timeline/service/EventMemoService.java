package com.yeoun.domain.timeline.service;

import com.yeoun.domain.timeline.dto.request.EventMemoUpsertRequest;
import com.yeoun.domain.timeline.dto.response.EventMemoUpsertResponse;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventMemo;
import com.yeoun.domain.timeline.repository.EventMemoRepository;
import com.yeoun.domain.timeline.repository.EventRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class EventMemoService {

    private final EventMemoRepository eventMemoRepository;
    private final EventRepository eventRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public EventMemoService(
            EventMemoRepository eventMemoRepository,
            EventRepository eventRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.eventMemoRepository = eventMemoRepository;
        this.eventRepository = eventRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    @Transactional
    public EventMemoUpsertResponse upsertEventMemo(UUID requesterUserId, UUID eventId, EventMemoUpsertRequest request) {
        getAccessibleEvent(eventId, requesterUserId);

        String trimmedContent = request.content().trim();
        if (trimmedContent.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Memo content is required.");
        }
        if (trimmedContent.length() > 1000) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Memo content must be 1000 characters or fewer.");
        }

        EventMemo existingMemo = eventMemoRepository.findByEventIdAndUserId(eventId, requesterUserId).orElse(null);
        if (existingMemo == null) {
            Instant now = Instant.now();
            EventMemo newMemo = EventMemo.builder()
                    .eventMemoId(UUID.randomUUID())
                    .eventId(eventId)
                    .userId(requesterUserId)
                    .content(trimmedContent)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            EventMemo saved = eventMemoRepository.save(newMemo);
            return toResponse(saved);
        }

        if (!existingMemo.getContent().equals(trimmedContent)) {
            existingMemo.updateContent(trimmedContent, Instant.now());
        }
        return toResponse(existingMemo);
    }

    private Event getAccessibleEvent(UUID eventId, UUID requesterUserId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new BaseException(ErrorCode.EVENT_NOT_FOUND));

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(event.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);
        return event;
    }

    private void validateTripAccessible(UUID requesterUserId, Trip trip) {
        if (trip.getOwnerUserId().equals(requesterUserId)) {
            return;
        }

        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }

    private EventMemoUpsertResponse toResponse(EventMemo eventMemo) {
        return new EventMemoUpsertResponse(
                eventMemo.getEventMemoId(),
                eventMemo.getEventId(),
                eventMemo.getUserId(),
                eventMemo.getContent(),
                eventMemo.getCreatedAt(),
                eventMemo.getUpdatedAt()
        );
    }
}
