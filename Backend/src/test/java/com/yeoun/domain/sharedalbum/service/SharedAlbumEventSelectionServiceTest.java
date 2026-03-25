package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.domain.sharedalbum.entity.SharedAlbumEventSelection;
import com.yeoun.domain.sharedalbum.entity.SharedAlbumVisibility;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumEventSelectionRepository;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventCreatedBy;
import com.yeoun.domain.timeline.entity.EventType;
import com.yeoun.domain.timeline.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SharedAlbumEventSelectionServiceTest {

    @Mock
    private SharedAlbumEventSelectionRepository sharedAlbumEventSelectionRepository;

    @Mock
    private EventRepository eventRepository;

    @InjectMocks
    private SharedAlbumEventSelectionService sharedAlbumEventSelectionService;

    @Test
    void resolveVisibleEvents_returnsDefaultVisibleEvents_whenSelectionNotApplied() {
        UUID tripId = UUID.randomUUID();
        SharedAlbum sharedAlbum = sharedAlbum(false, tripId);
        Event event = visibleEvent(tripId);

        when(eventRepository.findByTripIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(tripId))
                .thenReturn(List.of(event));

        List<Event> result = sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum);

        assertThat(result).containsExactly(event);
    }

    @Test
    void resolveVisibleEvents_returnsEmpty_whenSelectionAppliedAndNoSelectionExists() {
        UUID tripId = UUID.randomUUID();
        SharedAlbum sharedAlbum = sharedAlbum(true, tripId);

        when(sharedAlbumEventSelectionRepository.findBySharedAlbumIdOrderByDisplayOrderAsc(sharedAlbum.getSharedAlbumId()))
                .thenReturn(List.of());

        List<Event> result = sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum);

        assertThat(result).isEmpty();
    }

    @Test
    void resolveVisibleEvents_preservesSelectionOrder_whenSelectionApplied() {
        UUID tripId = UUID.randomUUID();
        SharedAlbum sharedAlbum = sharedAlbum(true, tripId);
        Event first = visibleEvent(tripId);
        Event second = visibleEvent(tripId);

        when(sharedAlbumEventSelectionRepository.findBySharedAlbumIdOrderByDisplayOrderAsc(sharedAlbum.getSharedAlbumId()))
                .thenReturn(List.of(
                        selection(sharedAlbum.getSharedAlbumId(), second.getEventId(), 0),
                        selection(sharedAlbum.getSharedAlbumId(), first.getEventId(), 1)
                ));
        when(eventRepository.findAllById(List.of(second.getEventId(), first.getEventId())))
                .thenReturn(List.of(first, second));

        List<Event> result = sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum);

        assertThat(result).containsExactly(second, first);
    }

    private SharedAlbum sharedAlbum(boolean selectionApplied, UUID tripId) {
        Instant now = Instant.parse("2026-03-25T00:00:00Z");
        return SharedAlbum.builder()
                .sharedAlbumId(UUID.randomUUID())
                .tripId(tripId)
                .title("album")
                .visibility(SharedAlbumVisibility.PUBLIC)
                .eventSelectionApplied(selectionApplied)
                .createdByUserId(UUID.randomUUID())
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private SharedAlbumEventSelection selection(UUID sharedAlbumId, UUID eventId, int displayOrder) {
        return SharedAlbumEventSelection.builder()
                .sharedAlbumEventSelectionId(UUID.randomUUID())
                .sharedAlbumId(sharedAlbumId)
                .eventId(eventId)
                .displayOrder(displayOrder)
                .createdAt(Instant.parse("2026-03-25T00:00:00Z"))
                .build();
    }

    private Event visibleEvent(UUID tripId) {
        Instant now = Instant.parse("2026-03-25T00:00:00Z");
        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(UUID.randomUUID())
                .createdBy(EventCreatedBy.SYSTEM)
                .eventType(EventType.PLACE_VISIT)
                .title("event")
                .placeName("place")
                .startAt(now)
                .endAt(now.plusSeconds(60))
                .hidden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
