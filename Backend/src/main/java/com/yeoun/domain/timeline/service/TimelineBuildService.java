package com.yeoun.domain.timeline.service;

import com.yeoun.domain.locationlog.entity.LocationPlace;
import com.yeoun.domain.locationlog.repository.LocationPlaceRepository;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.timeline.dto.response.TimelineBuildJobResponse;
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
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;
import com.yeoun.domain.tripprocessing.service.TripProcessingStatusService;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

@Service
@Transactional
public class TimelineBuildService {

    private static final Logger log = LoggerFactory.getLogger(TimelineBuildService.class);
    private static final Duration EVENT_SPLIT_THRESHOLD = Duration.ofHours(2);
    private static final ZoneId DEFAULT_ZONE_ID = ZoneId.of("Asia/Seoul");

    private final TripRepository tripRepository;
    private final PhotoRepository photoRepository;
    private final LocationPlaceRepository locationPlaceRepository;
    private final TimelineDayRepository timelineDayRepository;
    private final EventRepository eventRepository;
    private final EventPhotoRepository eventPhotoRepository;
    private final TripProcessingStatusService tripProcessingStatusService;
    private final EventPlaceResolverService eventPlaceResolverService;

    public TimelineBuildService(
            TripRepository tripRepository,
            PhotoRepository photoRepository,
            LocationPlaceRepository locationPlaceRepository,
            TimelineDayRepository timelineDayRepository,
            EventRepository eventRepository,
            EventPhotoRepository eventPhotoRepository,
            TripProcessingStatusService tripProcessingStatusService,
            EventPlaceResolverService eventPlaceResolverService
    ) {
        this.tripRepository = tripRepository;
        this.photoRepository = photoRepository;
        this.locationPlaceRepository = locationPlaceRepository;
        this.timelineDayRepository = timelineDayRepository;
        this.eventRepository = eventRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.tripProcessingStatusService = tripProcessingStatusService;
        this.eventPlaceResolverService = eventPlaceResolverService;
    }

    public TimelineBuildJobResponse buildTimelineFromPhotos(UUID requesterUserId, UUID tripId) {
        log.info("타임라인 생성을 시작합니다. tripId={}, requesterUserId={}", tripId, requesterUserId);
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
        if (trip.getStatus() != TripStatus.ACTIVE && trip.getStatus() != TripStatus.ENDED) {
            throw new BaseException(ErrorCode.TIMELINE_BUILD_NOT_ALLOWED, "Timeline build is allowed only for active or ended trips.");
        }

        Instant now = Instant.now();
        tripProcessingStatusService.markPending(tripId, now);

        try {
            tripProcessingStatusService.markProcessing(tripId, now);

            timelineDayRepository.deleteByTripId(tripId);

            List<Photo> photos = photoRepository.findByTripIdOrderByTakenAtAscCreatedAtAsc(tripId).stream()
                    .filter(photo -> !photo.isExcluded())
                    .sorted(Comparator.comparing(this::effectivePhotoTime))
                    .toList();
            List<LocationPlace> places = locationPlaceRepository.findByTripIdOrderByStartedAtAscUserIdAsc(tripId);
            log.info("타임라인 생성용 원본 데이터를 불러왔습니다. tripId={}, photoCount={}, placeCount={}",
                    tripId, photos.size(), places.size());

            BuildResult result = rebuildTimeline(tripId, places, photos, now);
            tripProcessingStatusService.markReady(tripId, now);
            log.info("타임라인 생성을 완료했습니다. tripId={}, timelineDayCount={}, eventCount={}",
                    tripId, result.timelineDayCount(), result.eventCount());

            return new TimelineBuildJobResponse(
                    tripId,
                    TripProcessingStatusType.READY,
                    result.timelineDayCount(),
                    result.eventCount(),
                    now,
                    now
            );
        } catch (RuntimeException ex) {
            log.error("타임라인 생성에 실패했습니다. tripId={}", tripId, ex);
            tripProcessingStatusService.markFailed(tripId, now, ex.getMessage());
            throw ex;
        }
    }

    public TimelineBuildJobResponse buildTimelineFromLocationProcessing(UUID tripId) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
        return buildTimelineFromPhotos(trip.getOwnerUserId(), tripId);
    }

    private BuildResult rebuildTimeline(UUID tripId, List<LocationPlace> places, List<Photo> photos, Instant now) {
        if (places.isEmpty() && photos.isEmpty()) {
            return new BuildResult(0, 0);
        }

        List<EventDraft> eventDrafts = createLocationEventDrafts(places);
        List<Photo> unassignedPhotos = assignPhotosToLocationEvents(eventDrafts, photos);
        eventDrafts.addAll(createPhotoEventDrafts(unassignedPhotos));

        if (eventDrafts.isEmpty()) {
            return new BuildResult(0, 0);
        }

        Map<LocalDate, List<EventDraft>> eventsByDay = new TreeMap<>();
        for (EventDraft eventDraft : eventDrafts) {
            eventsByDay.computeIfAbsent(resolveDayDate(eventDraft), ignored -> new ArrayList<>()).add(eventDraft);
        }

        int timelineDayCount = 0;
        int eventCount = 0;

        for (Map.Entry<LocalDate, List<EventDraft>> entry : eventsByDay.entrySet()) {
            List<EventDraft> dayEvents = entry.getValue().stream()
                    .sorted(Comparator
                            .comparing(EventDraft::startAt)
                            .thenComparing(EventDraft::endAt)
                            .thenComparing(EventDraft::createdAt))
                    .toList();
            TimelineDay timelineDay = TimelineDay.builder()
                    .timelineDayId(UUID.randomUUID())
                    .tripId(tripId)
                    .dayDate(entry.getKey())
                    .summaryText(null)
                    .distanceM((BigDecimal) null)
                    .photoCount(dayEvents.stream().mapToInt(event -> event.photos().size()).sum())
                    .eventCount(dayEvents.size())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            timelineDayRepository.save(timelineDay);
            timelineDayCount++;

            for (EventDraft eventDraft : dayEvents) {
                Event event = createEvent(tripId, timelineDay.getTimelineDayId(), eventDraft, now);
                eventRepository.save(event);
                saveEventPhotos(event.getEventId(), eventDraft.photos(), now);
                eventCount++;
            }
        }

        return new BuildResult(timelineDayCount, eventCount);
    }

    private Event createEvent(UUID tripId, UUID timelineDayId, EventDraft eventDraft, Instant now) {
        log.info("타임라인 이벤트를 생성합니다. tripId={}, timelineDayId={}, eventType={}, placeName={}, placeProvider={}, providerPlaceId={}, photoCount={}",
                tripId, timelineDayId, eventDraft.eventType(), eventDraft.placeName(),
                eventDraft.placeProvider(), eventDraft.providerPlaceId(), eventDraft.photos().size());
        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDayId)
                .createdBy(EventCreatedBy.SYSTEM)
                .eventType(eventDraft.eventType())
                .title(eventDraft.title())
                .placeName(eventDraft.placeName())
                .placeProvider(eventDraft.placeProvider())
                .providerPlaceId(eventDraft.providerPlaceId())
                .placeExternalId(eventDraft.placeExternalId())
                .startAt(eventDraft.startAt())
                .endAt(eventDraft.endAt())
                .centerLatitude(eventDraft.centerLatitude())
                .centerLongitude(eventDraft.centerLongitude())
                .radiusM(null)
                .hidden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void saveEventPhotos(UUID eventId, List<Photo> photos, Instant now) {
        for (int i = 0; i < photos.size(); i++) {
            Photo photo = photos.get(i);
            EventPhoto eventPhoto = EventPhoto.builder()
                    .eventPhotoId(UUID.randomUUID())
                    .eventId(eventId)
                    .photoId(photo.getPhotoId())
                    .sortOrder(i + 1)
                    .representative(i == 0)
                    .createdAt(now)
                    .build();
            eventPhotoRepository.save(eventPhoto);
        }
    }

    private List<EventDraft> createLocationEventDrafts(List<LocationPlace> places) {
        List<EventDraft> drafts = new ArrayList<>();
        for (LocationPlace place : places) {
            KakaoLocalClient.ResolvedPlace resolvedPlace = eventPlaceResolverService
                    .resolveResolvedPlace(place.getCenterLatitude(), place.getCenterLongitude())
                    .orElse(null);
            log.info("PLACE_VISIT 초안 생성 완료. placeExternalId={}, startAt={}, endAt={}, placeName={}, placeProvider={}, providerPlaceId={}",
                    place.getPlaceId(), place.getStartedAt(), place.getEndedAt(),
                    resolvedPlace == null ? null : resolvedPlace.name(),
                    resolvedPlace == null ? null : resolvedPlace.provider(),
                    resolvedPlace == null ? null : resolvedPlace.providerPlaceId());
            drafts.add(new EventDraft(
                    EventType.PLACE_VISIT,
                    null,
                    resolvedPlace == null ? null : resolvedPlace.name(),
                    resolvedPlace == null ? null : resolvedPlace.provider(),
                    resolvedPlace == null ? null : resolvedPlace.providerPlaceId(),
                    place.getPlaceId().toString(),
                    place.getStartedAt(),
                    place.getEndedAt(),
                    place.getCenterLatitude(),
                    place.getCenterLongitude(),
                    new ArrayList<>(),
                    place.getCreatedAt()
            ));
        }
        return drafts;
    }

    private List<Photo> assignPhotosToLocationEvents(List<EventDraft> locationEventDrafts, List<Photo> photos) {
        List<Photo> unassignedPhotos = new ArrayList<>();
        for (Photo photo : photos) {
            EventDraft matchedEvent = findMatchingLocationEvent(locationEventDrafts, photo);
            if (matchedEvent == null) {
                unassignedPhotos.add(photo);
                continue;
            }
            matchedEvent.photos().add(photo);
        }
        for (EventDraft eventDraft : locationEventDrafts) {
            eventDraft.photos().sort(Comparator.comparing(this::effectivePhotoTime));
        }
        return unassignedPhotos;
    }

    private EventDraft findMatchingLocationEvent(List<EventDraft> locationEventDrafts, Photo photo) {
        Instant photoTime = effectivePhotoTime(photo);
        for (EventDraft eventDraft : locationEventDrafts) {
            if (!photoTime.isBefore(eventDraft.startAt()) && !photoTime.isAfter(eventDraft.endAt())) {
                return eventDraft;
            }
        }
        return null;
    }

    private List<EventDraft> createPhotoEventDrafts(List<Photo> photos) {
        Map<LocalDate, List<Photo>> photosByDay = new LinkedHashMap<>();
        for (Photo photo : photos) {
            photosByDay.computeIfAbsent(resolveDayDate(photo), ignored -> new ArrayList<>()).add(photo);
        }

        List<EventDraft> drafts = new ArrayList<>();
        for (List<Photo> dayPhotos : photosByDay.values()) {
            List<List<Photo>> photoGroups = splitIntoPhotoGroups(dayPhotos);
            for (List<Photo> photoGroup : photoGroups) {
                Photo firstPhoto = photoGroup.get(0);
                Photo lastPhoto = photoGroup.get(photoGroup.size() - 1);
                BigDecimal centerLatitude = medianCoordinate(photoGroup.stream()
                        .map(Photo::getExifLatitude)
                        .toList());
                BigDecimal centerLongitude = medianCoordinate(photoGroup.stream()
                        .map(Photo::getExifLongitude)
                        .toList());
                KakaoLocalClient.ResolvedPlace resolvedPlace = eventPlaceResolverService
                        .resolveResolvedPlace(centerLatitude, centerLongitude)
                        .orElse(null);
                log.info("사진 기반 OTHER 초안 생성 완료. firstPhotoId={}, photoCount={}, placeName={}, placeProvider={}, providerPlaceId={}",
                        firstPhoto.getPhotoId(), photoGroup.size(),
                        resolvedPlace == null ? null : resolvedPlace.name(),
                        resolvedPlace == null ? null : resolvedPlace.provider(),
                        resolvedPlace == null ? null : resolvedPlace.providerPlaceId());
                drafts.add(new EventDraft(
                        EventType.OTHER,
                        null,
                        resolvedPlace == null ? null : resolvedPlace.name(),
                        resolvedPlace == null ? null : resolvedPlace.provider(),
                        resolvedPlace == null ? null : resolvedPlace.providerPlaceId(),
                        null,
                        effectivePhotoTime(firstPhoto),
                        effectivePhotoTime(lastPhoto),
                        centerLatitude,
                        centerLongitude,
                        new ArrayList<>(photoGroup),
                        firstPhoto.getCreatedAt()
                ));
            }
        }
        return drafts;
    }

    private List<List<Photo>> splitIntoPhotoGroups(List<Photo> dayPhotos) {
        List<List<Photo>> groups = new ArrayList<>();
        List<Photo> currentGroup = new ArrayList<>();
        Instant previousTime = null;

        for (Photo photo : dayPhotos) {
            Instant currentTime = effectivePhotoTime(photo);
            if (previousTime != null && Duration.between(previousTime, currentTime).compareTo(EVENT_SPLIT_THRESHOLD) > 0) {
                groups.add(currentGroup);
                currentGroup = new ArrayList<>();
            }
            currentGroup.add(photo);
            previousTime = currentTime;
        }

        if (!currentGroup.isEmpty()) {
            groups.add(currentGroup);
        }
        return groups;
    }

    private LocalDate resolveDayDate(EventDraft eventDraft) {
        return eventDraft.startAt().atZone(DEFAULT_ZONE_ID).toLocalDate();
    }

    private LocalDate resolveDayDate(Photo photo) {
        return effectivePhotoTime(photo).atZone(resolveZoneId(photo)).toLocalDate();
    }

    private Instant effectivePhotoTime(Photo photo) {
        return photo.getTakenAt() != null ? photo.getTakenAt() : photo.getCreatedAt();
    }

    private ZoneId resolveZoneId(Photo photo) {
        if (photo.getTakenTimezone() == null || photo.getTakenTimezone().isBlank()) {
            return DEFAULT_ZONE_ID;
        }
        try {
            return ZoneId.of(photo.getTakenTimezone());
        } catch (Exception ignored) {
            return DEFAULT_ZONE_ID;
        }
    }

    private BigDecimal medianCoordinate(List<BigDecimal> values) {
        List<BigDecimal> filtered = values.stream()
                .filter(value -> value != null)
                .sorted(BigDecimal::compareTo)
                .toList();
        if (filtered.isEmpty()) {
            return null;
        }
        int mid = filtered.size() / 2;
        if (filtered.size() % 2 == 1) {
            return filtered.get(mid);
        }
        return filtered.get(mid - 1)
                .add(filtered.get(mid))
                .divide(BigDecimal.valueOf(2), 7, java.math.RoundingMode.HALF_UP);
    }

    private record BuildResult(int timelineDayCount, int eventCount) {
    }

    private record EventDraft(
            EventType eventType,
            String title,
            String placeName,
            String placeProvider,
            String providerPlaceId,
            String placeExternalId,
            Instant startAt,
            Instant endAt,
            BigDecimal centerLatitude,
            BigDecimal centerLongitude,
            List<Photo> photos,
            Instant createdAt
    ) {
    }
}
