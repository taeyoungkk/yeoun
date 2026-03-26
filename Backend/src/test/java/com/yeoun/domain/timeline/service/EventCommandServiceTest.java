package com.yeoun.domain.timeline.service;

import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.photo.service.PhotoProcessingImageUrlService;
import com.yeoun.domain.timeline.dto.request.EventUpdateRequest;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventCreatedBy;
import com.yeoun.domain.timeline.entity.EventPhoto;
import com.yeoun.domain.timeline.entity.EventType;
import com.yeoun.domain.timeline.entity.TimelineDay;
import com.yeoun.domain.timeline.repository.EventPhotoRepository;
import com.yeoun.domain.timeline.repository.EventRepository;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventCommandServiceTest {

    @Mock
    private EventRepository eventRepository;

    @Mock
    private EventPhotoRepository eventPhotoRepository;

    @Mock
    private TimelineDayRepository timelineDayRepository;

    @Mock
    private PhotoRepository photoRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private PhotoProcessingImageUrlService photoProcessingImageUrlService;

    @InjectMocks
    private EventCommandService eventCommandService;

    @Test
    void updateEvent_whenPlaceNameChanges_locksPlaceNameAndClearsProviderReference() {
        UUID requesterUserId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        UUID timelineDayId = UUID.randomUUID();
        Event event = event(tripId, timelineDayId, "Old Place", "KAKAO", "place-123");

        stubEditableEvent(requesterUserId, event, trip(tripId, requesterUserId), timelineDay(tripId, timelineDayId));

        EventUpdateRequest request = new EventUpdateRequest(
                null,
                "New Place",
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        eventCommandService.updateEvent(requesterUserId, event.getEventId(), request);

        assertThat(event.getPlaceName()).isEqualTo("New Place");
        assertThat(event.isPlaceNameLocked()).isTrue();
        assertThat(event.getPlaceProvider()).isNull();
        assertThat(event.getProviderPlaceId()).isNull();
    }

    @Test
    void updateEvent_whenPlaceNameIsUnchanged_keepsAutoResolvedReferenceUnlocked() {
        UUID requesterUserId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        UUID timelineDayId = UUID.randomUUID();
        Event event = event(tripId, timelineDayId, "Same Place", "KAKAO", "place-123");

        stubEditableEvent(requesterUserId, event, trip(tripId, requesterUserId), timelineDay(tripId, timelineDayId));

        EventUpdateRequest request = new EventUpdateRequest(
                null,
                "Same Place",
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        eventCommandService.updateEvent(requesterUserId, event.getEventId(), request);

        assertThat(event.getPlaceName()).isEqualTo("Same Place");
        assertThat(event.isPlaceNameLocked()).isFalse();
        assertThat(event.getPlaceProvider()).isEqualTo("KAKAO");
        assertThat(event.getProviderPlaceId()).isEqualTo("place-123");
    }

    private void stubEditableEvent(UUID requesterUserId, Event event, Trip trip, TimelineDay timelineDay) {
        when(eventRepository.findById(event.getEventId())).thenReturn(Optional.of(event));
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(trip.getTripId(), TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                com.yeoun.domain.trip.entity.TripMemberInviteStatus.ACCEPTED
        )).thenReturn(false);
        when(timelineDayRepository.findById(timelineDay.getTimelineDayId())).thenReturn(Optional.of(timelineDay));
        when(eventRepository.countByTimelineDayId(timelineDay.getTimelineDayId())).thenReturn(1L);
        when(eventRepository.findByTimelineDayIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(timelineDay.getTimelineDayId()))
                .thenReturn(List.of(event));
        when(eventPhotoRepository.findByEventIdInOrderByEventIdAscSortOrderAsc(List.of(event.getEventId())))
                .thenReturn(List.<EventPhoto>of());
    }

    private Event event(UUID tripId, UUID timelineDayId, String placeName, String placeProvider, String providerPlaceId) {
        Instant now = Instant.parse("2026-03-26T00:00:00Z");
        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDayId)
                .createdBy(EventCreatedBy.SYSTEM)
                .eventType(EventType.PLACE_VISIT)
                .title("Event")
                .placeName(placeName)
                .placeProvider(placeProvider)
                .providerPlaceId(providerPlaceId)
                .placeExternalId("internal-place-id")
                .startAt(now)
                .endAt(now.plusSeconds(600))
                .hidden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Trip trip(UUID tripId, UUID ownerUserId) {
        Instant now = Instant.parse("2026-03-26T00:00:00Z");
        return Trip.builder()
                .tripId(tripId)
                .ownerUserId(ownerUserId)
                .title("Trip")
                .startDate(LocalDate.of(2026, 3, 26))
                .endDate(LocalDate.of(2026, 3, 26))
                .status(TripStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private TimelineDay timelineDay(UUID tripId, UUID timelineDayId) {
        Instant now = Instant.parse("2026-03-26T00:00:00Z");
        return TimelineDay.builder()
                .timelineDayId(timelineDayId)
                .tripId(tripId)
                .dayDate(LocalDate.of(2026, 3, 26))
                .summaryText(null)
                .distanceM(null)
                .photoCount(0)
                .eventCount(1)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
