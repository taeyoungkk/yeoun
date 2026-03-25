package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.sharedalbum.entity.SharedAlbumEventSelection;
import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumEventSelectionRepository;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.repository.EventRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SharedAlbumEventSelectionService {

    private final SharedAlbumEventSelectionRepository sharedAlbumEventSelectionRepository;
    private final EventRepository eventRepository;

    public SharedAlbumEventSelectionService(
            SharedAlbumEventSelectionRepository sharedAlbumEventSelectionRepository,
            EventRepository eventRepository
    ) {
        this.sharedAlbumEventSelectionRepository = sharedAlbumEventSelectionRepository;
        this.eventRepository = eventRepository;
    }

    @Transactional(readOnly = true)
    public List<Event> resolveVisibleEvents(SharedAlbum sharedAlbum) {
        List<SharedAlbumEventSelection> selections =
                sharedAlbumEventSelectionRepository.findBySharedAlbumIdOrderByDisplayOrderAsc(sharedAlbum.getSharedAlbumId());
        if (!sharedAlbum.isEventSelectionApplied()) {
            return eventRepository.findByTripIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(sharedAlbum.getTripId());
        }

        Map<UUID, Event> visibleEventMap = eventRepository.findAllById(
                        selections.stream().map(SharedAlbumEventSelection::getEventId).toList()
                ).stream()
                .filter(event -> sharedAlbum.getTripId().equals(event.getTripId()))
                .filter(event -> !event.isHidden())
                .collect(LinkedHashMap::new, (map, event) -> map.put(event.getEventId(), event), Map::putAll);

        List<Event> results = new ArrayList<>();
        for (SharedAlbumEventSelection selection : selections) {
            Event event = visibleEventMap.get(selection.getEventId());
            if (event != null) {
                results.add(event);
            }
        }
        return results;
    }

    @Transactional
    public List<UUID> replaceSelections(UUID sharedAlbumId, UUID tripId, List<UUID> requestedEventIds) {
        List<UUID> normalizedEventIds = normalizeEventIds(requestedEventIds);
        Map<UUID, Event> eventMap = eventRepository.findAllById(normalizedEventIds).stream()
                .collect(LinkedHashMap::new, (map, event) -> map.put(event.getEventId(), event), Map::putAll);

        if (eventMap.size() != normalizedEventIds.size()) {
            throw new BaseException(ErrorCode.EVENT_NOT_FOUND);
        }

        for (UUID eventId : normalizedEventIds) {
            Event event = eventMap.get(eventId);
            if (!tripId.equals(event.getTripId()) || event.isHidden()) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Shared album events must be visible trip events.");
            }
        }

        sharedAlbumEventSelectionRepository.deleteBySharedAlbumId(sharedAlbumId);

        Instant now = Instant.now();
        for (int index = 0; index < normalizedEventIds.size(); index++) {
            sharedAlbumEventSelectionRepository.save(SharedAlbumEventSelection.builder()
                    .sharedAlbumEventSelectionId(UUID.randomUUID())
                    .sharedAlbumId(sharedAlbumId)
                    .eventId(normalizedEventIds.get(index))
                    .displayOrder(index)
                    .createdAt(now)
                    .build());
        }
        return normalizedEventIds;
    }

    private List<UUID> normalizeEventIds(List<UUID> requestedEventIds) {
        LinkedHashSet<UUID> normalized = new LinkedHashSet<>();
        if (requestedEventIds == null) {
            return List.of();
        }
        for (UUID eventId : requestedEventIds) {
            if (eventId != null) {
                normalized.add(eventId);
            }
        }
        return List.copyOf(normalized);
    }
}
