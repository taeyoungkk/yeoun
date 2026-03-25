package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.locationlog.entity.LocationRouteDay;
import com.yeoun.domain.locationlog.repository.LocationRouteDayRepository;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.photo.service.PhotoProcessingImageUrlService;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumCreateResponse;
import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.domain.sharedalbum.entity.SharedAlbumVisibility;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumMemberRepository;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumRepository;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.TimelineDay;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;
import com.yeoun.domain.tripprocessing.repository.TripProcessingStatusRepository;
import com.yeoun.domain.user.repository.UserRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SharedAlbumServiceTest {

    @Mock
    private SharedAlbumRepository sharedAlbumRepository;

    @Mock
    private SharedAlbumMemberRepository sharedAlbumMemberRepository;

    @Mock
    private SharedAlbumAccessService sharedAlbumAccessService;

    @Mock
    private SharedAlbumEventSelectionService sharedAlbumEventSelectionService;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private TimelineDayRepository timelineDayRepository;

    @Mock
    private LocationRouteDayRepository locationRouteDayRepository;

    @Mock
    private PhotoRepository photoRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private TripProcessingStatusRepository tripProcessingStatusRepository;

    @Mock
    private PhotoProcessingImageUrlService photoProcessingImageUrlService;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SharedAlbumService sharedAlbumService;

    @Test
    void getPublicSharedAlbum_usesOnlyCreatorRouteDistanceInSummary() {
        UUID tripId = UUID.randomUUID();
        UUID creatorUserId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        UUID timelineDayId = UUID.randomUUID();

        SharedAlbum sharedAlbum = sharedAlbum(tripId, creatorUserId, false);
        Trip trip = trip(tripId, creatorUserId);
        TimelineDay timelineDay = timelineDay(tripId, timelineDayId, LocalDate.of(2026, 3, 25));
        Event event = event(tripId, timelineDayId);

        when(sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbum.getSharedAlbumId())).thenReturn(sharedAlbum);
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(timelineDayRepository.findByTripIdOrderByDayDateAsc(tripId)).thenReturn(List.of(timelineDay));
        when(sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum)).thenReturn(List.of(event));
        when(locationRouteDayRepository.findByTripIdOrderByDayAscUserIdAsc(tripId)).thenReturn(List.of(
                routeDay(tripId, creatorUserId, LocalDate.of(2026, 3, 25), "1000.00"),
                routeDay(tripId, otherUserId, LocalDate.of(2026, 3, 25), "3000.00")
        ));
        when(tripMemberRepository.countByTripIdAndInviteStatusAndLeftAtIsNull(tripId, com.yeoun.domain.trip.entity.TripMemberInviteStatus.ACCEPTED))
                .thenReturn(2L);
        when(photoRepository.countByTripIdAndExcludedFalse(tripId)).thenReturn(5L);
        when(expenseRepository.sumConfirmedAmountByTripIdAndStatus(tripId, ExpenseStatus.CONFIRMED))
                .thenReturn(new BigDecimal("20000.00"));
        when(tripProcessingStatusRepository.findById(tripId)).thenReturn(Optional.empty());

        SharedAlbumCreateResponse response = sharedAlbumService.getPublicSharedAlbum(sharedAlbum.getSharedAlbumId());

        assertThat(response.sharedAlbum().tripSummary().totalDistanceM()).isEqualByComparingTo("1000.00");
        assertThat(response.sharedAlbum().daySummaries()).hasSize(1);
        assertThat(response.sharedAlbum().daySummaries().get(0).distanceM()).isEqualByComparingTo("1000.00");
    }

    @Test
    void getPublicSharedAlbum_returnsNoTimelineWhenSelectionAppliedButEmpty() {
        UUID tripId = UUID.randomUUID();
        UUID creatorUserId = UUID.randomUUID();
        UUID timelineDayId = UUID.randomUUID();

        SharedAlbum sharedAlbum = sharedAlbum(tripId, creatorUserId, true);
        Trip trip = trip(tripId, creatorUserId);
        TimelineDay timelineDay = timelineDay(tripId, timelineDayId, LocalDate.of(2026, 3, 25));

        when(sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbum.getSharedAlbumId())).thenReturn(sharedAlbum);
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(timelineDayRepository.findByTripIdOrderByDayDateAsc(tripId)).thenReturn(List.of(timelineDay));
        when(sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum)).thenReturn(List.of());
        when(locationRouteDayRepository.findByTripIdOrderByDayAscUserIdAsc(tripId)).thenReturn(List.of());
        when(tripMemberRepository.countByTripIdAndInviteStatusAndLeftAtIsNull(tripId, com.yeoun.domain.trip.entity.TripMemberInviteStatus.ACCEPTED))
                .thenReturn(1L);
        when(photoRepository.countByTripIdAndExcludedFalse(tripId)).thenReturn(0L);
        when(expenseRepository.sumConfirmedAmountByTripIdAndStatus(tripId, ExpenseStatus.CONFIRMED))
                .thenReturn(BigDecimal.ZERO.setScale(2));
        when(tripProcessingStatusRepository.findById(tripId)).thenReturn(Optional.empty());

        SharedAlbumCreateResponse response = sharedAlbumService.getPublicSharedAlbum(sharedAlbum.getSharedAlbumId());

        assertThat(response.sharedAlbum().tripSummary().recordCount()).isZero();
        assertThat(response.sharedAlbum().sections().timelineAvailable()).isFalse();
        assertThat(response.sharedAlbum().daySummaries().get(0).recordCount()).isZero();
    }

    private SharedAlbum sharedAlbum(UUID tripId, UUID creatorUserId, boolean eventSelectionApplied) {
        Instant now = Instant.parse("2026-03-25T00:00:00Z");
        return SharedAlbum.builder()
                .sharedAlbumId(UUID.randomUUID())
                .tripId(tripId)
                .title("album")
                .regionLabel("제주")
                .visibility(SharedAlbumVisibility.PUBLIC)
                .eventSelectionApplied(eventSelectionApplied)
                .createdByUserId(creatorUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Trip trip(UUID tripId, UUID ownerUserId) {
        Instant now = Instant.parse("2026-03-25T00:00:00Z");
        return Trip.builder()
                .tripId(tripId)
                .ownerUserId(ownerUserId)
                .title("제주 여행")
                .startDate(LocalDate.of(2026, 3, 25))
                .endDate(LocalDate.of(2026, 3, 25))
                .status(TripStatus.ENDED)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private TimelineDay timelineDay(UUID tripId, UUID timelineDayId, LocalDate dayDate) {
        Instant now = Instant.parse("2026-03-25T00:00:00Z");
        return TimelineDay.builder()
                .timelineDayId(timelineDayId)
                .tripId(tripId)
                .dayDate(dayDate)
                .summaryText("summary")
                .distanceM(new BigDecimal("9999.00"))
                .photoCount(0)
                .eventCount(3)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Event event(UUID tripId, UUID timelineDayId) {
        Instant now = Instant.parse("2026-03-25T00:00:00Z");
        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDayId)
                .createdBy(com.yeoun.domain.timeline.entity.EventCreatedBy.SYSTEM)
                .eventType(com.yeoun.domain.timeline.entity.EventType.PLACE_VISIT)
                .title("event")
                .placeName("place")
                .startAt(now)
                .endAt(now.plusSeconds(60))
                .hidden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private LocationRouteDay routeDay(UUID tripId, UUID userId, LocalDate day, String distance) {
        Instant now = Instant.parse("2026-03-25T00:00:00Z");
        return LocationRouteDay.builder()
                .routeDayId(UUID.randomUUID())
                .tripId(tripId)
                .userId(userId)
                .day(day)
                .pointCount(10)
                .distanceM(new BigDecimal(distance))
                .coordinatesJson("[]")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
