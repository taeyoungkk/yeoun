package com.yeoun.domain.timeline.service;

import com.yeoun.domain.locationlog.entity.LocationLogSource;
import com.yeoun.domain.locationlog.entity.LocationPlace;
import com.yeoun.domain.locationlog.repository.LocationPlaceRepository;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventCreatedBy;
import com.yeoun.domain.timeline.entity.EventType;
import com.yeoun.domain.timeline.entity.TimelineDay;
import com.yeoun.domain.timeline.repository.EventMemoRepository;
import com.yeoun.domain.timeline.repository.EventPhotoRepository;
import com.yeoun.domain.timeline.repository.EventRepository;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TimelineIncrementalSyncServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private LocationPlaceRepository locationPlaceRepository;

    @Mock
    private PhotoRepository photoRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private EventPhotoRepository eventPhotoRepository;

    @Mock
    private EventMemoRepository eventMemoRepository;

    @Mock
    private TimelineDayRepository timelineDayRepository;

    @Mock
    private EventPlaceResolverService eventPlaceResolverService;

    @InjectMocks
    private TimelineIncrementalSyncService timelineIncrementalSyncService;

    @Test
    void syncTrip_whenReResolutionFails_clearsStaleProviderReference() {
        UUID tripId = UUID.randomUUID();
        UUID timelineDayId = UUID.randomUUID();
        UUID internalPlaceId = UUID.randomUUID();
        Event event = event(tripId, timelineDayId, internalPlaceId.toString(), "KAKAO", "stale-place-id");
        Trip trip = trip(tripId);
        TimelineDay timelineDay = timelineDay(tripId, timelineDayId);
        LocationPlace locationPlace = locationPlace(tripId, internalPlaceId);

        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(locationPlaceRepository.findByTripIdOrderByStartedAtAscUserIdAsc(tripId)).thenReturn(List.of(locationPlace));
        when(eventRepository.findByTripIdAndEventTypeOrderByStartAtAscEndAtAscCreatedAtAsc(tripId, EventType.PLACE_VISIT))
                .thenReturn(List.of(event));
        when(eventRepository.findByTripIdAndEventTypeOrderByStartAtAscEndAtAscCreatedAtAsc(tripId, EventType.OTHER))
                .thenReturn(List.of());
        when(photoRepository.findByTripIdOrderByTakenAtAscCreatedAtAsc(tripId)).thenReturn(List.<Photo>of());
        when(eventPhotoRepository.findByPhotoIdIn(List.of())).thenReturn(List.of());
        when(eventRepository.findByTripIdAndPlaceExternalId(tripId, internalPlaceId.toString())).thenReturn(Optional.of(event));
        when(eventPlaceResolverService.resolveResolvedPlace(locationPlace.getCenterLatitude(), locationPlace.getCenterLongitude()))
                .thenReturn(Optional.empty());
        when(eventPlaceResolverService.resolvePlaceName(locationPlace.getCenterLatitude(), locationPlace.getCenterLongitude()))
                .thenReturn(Optional.empty());
        when(timelineDayRepository.findById(timelineDayId)).thenReturn(Optional.of(timelineDay));
        when(eventRepository.countByTimelineDayId(timelineDayId)).thenReturn(1L);
        when(eventRepository.findByTimelineDayIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(timelineDayId))
                .thenReturn(List.of(event));
        when(eventPhotoRepository.findByEventIdInOrderByEventIdAscSortOrderAsc(List.of(event.getEventId())))
                .thenReturn(List.of());

        timelineIncrementalSyncService.syncTrip(tripId);

        assertThat(event.getCenterLatitude()).isEqualByComparingTo(locationPlace.getCenterLatitude());
        assertThat(event.getCenterLongitude()).isEqualByComparingTo(locationPlace.getCenterLongitude());
        assertThat(event.getPlaceProvider()).isNull();
        assertThat(event.getProviderPlaceId()).isNull();
    }

    private Event event(UUID tripId, UUID timelineDayId, String placeExternalId, String placeProvider, String providerPlaceId) {
        Instant now = Instant.parse("2026-03-26T01:00:00Z");
        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDayId)
                .createdBy(EventCreatedBy.SYSTEM)
                .eventType(EventType.PLACE_VISIT)
                .title(null)
                .placeName("Original Place")
                .placeProvider(placeProvider)
                .providerPlaceId(providerPlaceId)
                .placeExternalId(placeExternalId)
                .startAt(now)
                .endAt(now.plusSeconds(600))
                .centerLatitude(new BigDecimal("37.5000000"))
                .centerLongitude(new BigDecimal("127.0000000"))
                .hidden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Trip trip(UUID tripId) {
        Instant now = Instant.parse("2026-03-26T00:00:00Z");
        return Trip.builder()
                .tripId(tripId)
                .ownerUserId(UUID.randomUUID())
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

    private LocationPlace locationPlace(UUID tripId, UUID placeId) {
        Instant now = Instant.parse("2026-03-26T01:00:00Z");
        return LocationPlace.builder()
                .placeRowId(UUID.randomUUID())
                .placeId(placeId)
                .tripId(tripId)
                .userId(UUID.randomUUID())
                .startedAt(now)
                .endedAt(now.plusSeconds(300))
                .durationSeconds(300)
                .centerLatitude(new BigDecimal("37.5011111"))
                .centerLongitude(new BigDecimal("127.0011111"))
                .staySegmentCount(1)
                .source(LocationLogSource.GPS)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
