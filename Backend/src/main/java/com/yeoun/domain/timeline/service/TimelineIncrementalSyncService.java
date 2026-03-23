package com.yeoun.domain.timeline.service;

import com.yeoun.domain.locationlog.entity.LocationPlace;
import com.yeoun.domain.locationlog.repository.LocationPlaceRepository;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventCreatedBy;
import com.yeoun.domain.timeline.entity.EventPhoto;
import com.yeoun.domain.timeline.entity.EventType;
import com.yeoun.domain.timeline.entity.TimelineDay;
import com.yeoun.domain.timeline.repository.EventMemoRepository;
import com.yeoun.domain.timeline.repository.EventPhotoRepository;
import com.yeoun.domain.timeline.repository.EventRepository;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class TimelineIncrementalSyncService {

    private static final ZoneId DEFAULT_ZONE_ID = ZoneId.of("Asia/Seoul");
    private static final long MATCH_DISTANCE_M = 100L;
    private static final long MATCH_TIME_GAP_SECONDS = 15 * 60L;
    private static final long PHOTO_EVENT_SPLIT_SECONDS = 2 * 60 * 60L;

    private final TripRepository tripRepository;
    private final LocationPlaceRepository locationPlaceRepository;
    private final PhotoRepository photoRepository;
    private final EventRepository eventRepository;
    private final EventPhotoRepository eventPhotoRepository;
    private final EventMemoRepository eventMemoRepository;
    private final TimelineDayRepository timelineDayRepository;

    public TimelineIncrementalSyncService(
            TripRepository tripRepository,
            LocationPlaceRepository locationPlaceRepository,
            PhotoRepository photoRepository,
            EventRepository eventRepository,
            EventPhotoRepository eventPhotoRepository,
            EventMemoRepository eventMemoRepository,
            TimelineDayRepository timelineDayRepository
    ) {
        this.tripRepository = tripRepository;
        this.locationPlaceRepository = locationPlaceRepository;
        this.photoRepository = photoRepository;
        this.eventRepository = eventRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.eventMemoRepository = eventMemoRepository;
        this.timelineDayRepository = timelineDayRepository;
    }

    public void syncTrip(UUID tripId) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
        if (trip.getStatus() != TripStatus.ACTIVE && trip.getStatus() != TripStatus.ENDED) {
            return;
        }

        Instant now = Instant.now();
        List<LocationPlace> places = locationPlaceRepository.findByTripIdOrderByStartedAtAscUserIdAsc(tripId);
        List<Event> placeEvents = new ArrayList<>(eventRepository.findByTripIdAndEventTypeOrderByStartAtAscEndAtAscCreatedAtAsc(tripId, EventType.PLACE_VISIT));
        List<Event> otherEvents = new ArrayList<>(eventRepository.findByTripIdAndEventTypeOrderByStartAtAscEndAtAscCreatedAtAsc(tripId, EventType.OTHER));
        List<Photo> photos = photoRepository.findByTripIdOrderByTakenAtAscCreatedAtAsc(tripId).stream()
                .filter(photo -> !photo.isExcluded())
                .toList();
        if (places.isEmpty() && photos.isEmpty()) {
            return;
        }
        Set<UUID> linkedPhotoIds = new HashSet<>(eventPhotoRepository.findByPhotoIdIn(photos.stream().map(Photo::getPhotoId).toList())
                .stream()
                .map(EventPhoto::getPhotoId)
                .toList());
        Set<UUID> affectedTimelineDayIds = new HashSet<>();

        for (LocationPlace place : places) {
            Event matchedEvent = findMatchedEvent(tripId, place, placeEvents);
            if (matchedEvent == null) {
                Event promotedOtherEvent = findPromotableOtherEvent(place, otherEvents);
                if (promotedOtherEvent != null) {
                    UUID originalTimelineDayId = promotedOtherEvent.getTimelineDayId();
                    matchedEvent = promoteOtherEventToPlaceVisit(promotedOtherEvent, tripId, place, now);
                    otherEvents.remove(promotedOtherEvent);
                    placeEvents.add(promotedOtherEvent);
                    affectedTimelineDayIds.add(originalTimelineDayId);
                    affectedTimelineDayIds.add(matchedEvent.getTimelineDayId());
                } else {
                    TimelineDay timelineDay = getOrCreateTimelineDay(tripId, resolveDayDate(place.getStartedAt()), now);
                    Event createdEvent = createPlaceVisitEvent(tripId, timelineDay.getTimelineDayId(), place, now);
                    eventRepository.save(createdEvent);
                    placeEvents.add(createdEvent);
                    matchedEvent = createdEvent;
                    affectedTimelineDayIds.add(timelineDay.getTimelineDayId());
                }
            } else {
                UUID originalTimelineDayId = matchedEvent.getTimelineDayId();
                matchedEvent.updateBasicInfo(
                        matchedEvent.getTitle(),
                        matchedEvent.getPlaceName(),
                        matchedEvent.getPlaceExternalId() != null ? matchedEvent.getPlaceExternalId() : place.getPlaceId().toString(),
                        mergeStartAt(matchedEvent.getStartAt(), place.getStartedAt()),
                        mergeEndAt(matchedEvent.getEndAt(), place.getEndedAt()),
                        mergeCoordinate(matchedEvent.getCenterLatitude(), place.getCenterLatitude()),
                        mergeCoordinate(matchedEvent.getCenterLongitude(), place.getCenterLongitude()),
                        matchedEvent.getRadiusM(),
                        matchedEvent.isHidden(),
                        now
                );
                UUID newTimelineDayId = moveEventIfDayChanged(matchedEvent, tripId, originalTimelineDayId, now);
                affectedTimelineDayIds.add(originalTimelineDayId);
                affectedTimelineDayIds.add(newTimelineDayId);
            }

            absorbOtherEventsIntoPlaceEvent(matchedEvent, place, otherEvents, linkedPhotoIds, affectedTimelineDayIds, now);
            attachNewPhotos(matchedEvent, place, photos, linkedPhotoIds, now);
        }

        createPhotoOnlyEvents(tripId, photos, linkedPhotoIds, otherEvents, affectedTimelineDayIds, now);

        for (UUID timelineDayId : affectedTimelineDayIds) {
            recalculateTimelineDayCounts(timelineDayId, now);
        }
    }

    private Event findMatchedEvent(UUID tripId, LocationPlace place, List<Event> placeEvents) {
        Event exactMatch = eventRepository.findByTripIdAndPlaceExternalId(tripId, place.getPlaceId().toString())
                .orElse(null);
        if (exactMatch != null) {
            return exactMatch;
        }

        return placeEvents.stream()
                .filter(event -> isSameDay(event, place))
                .filter(event -> isTimeClose(event, place))
                .filter(event -> isDistanceClose(event, place))
                .min(Comparator.comparingLong(event -> distanceMeters(event, place)))
                .orElse(null);
    }

    private Event findPromotableOtherEvent(LocationPlace place, List<Event> otherEvents) {
        return otherEvents.stream()
                .filter(event -> !isProtectedOtherEvent(event))
                .filter(event -> isSameDay(event, place))
                .filter(event -> isTimeClose(event, place))
                .filter(event -> isDistanceCloseOrUnknown(event, place))
                .min(Comparator.comparingLong(event -> distanceMetersOrZero(event, place)))
                .orElse(null);
    }

    private Event promoteOtherEventToPlaceVisit(Event event, UUID tripId, LocationPlace place, Instant now) {
        UUID originalTimelineDayId = event.getTimelineDayId();
        event.changeEventType(EventType.PLACE_VISIT, now);
        event.updateBasicInfo(
                event.getTitle(),
                event.getPlaceName(),
                place.getPlaceId().toString(),
                mergeStartAt(event.getStartAt(), place.getStartedAt()),
                mergeEndAt(event.getEndAt(), place.getEndedAt()),
                mergeCoordinate(event.getCenterLatitude(), place.getCenterLatitude()),
                mergeCoordinate(event.getCenterLongitude(), place.getCenterLongitude()),
                event.getRadiusM(),
                event.isHidden(),
                now
        );
        moveEventIfDayChanged(event, tripId, originalTimelineDayId, now);
        return event;
    }

    private void absorbOtherEventsIntoPlaceEvent(
            Event placeEvent,
            LocationPlace place,
            List<Event> otherEvents,
            Set<UUID> linkedPhotoIds,
            Set<UUID> affectedTimelineDayIds,
            Instant now
    ) {
        List<Event> candidates = otherEvents.stream()
                .filter(event -> isSameDay(event, place))
                .filter(event -> isTimeClose(event, place))
                .filter(event -> isDistanceCloseOrUnknown(event, place))
                .filter(event -> !isProtectedOtherEvent(event))
                .toList();

        for (Event otherEvent : candidates) {
            transferPhotos(otherEvent, placeEvent, linkedPhotoIds, now);
            UUID otherTimelineDayId = otherEvent.getTimelineDayId();
            eventPhotoRepository.deleteByEventId(otherEvent.getEventId());
            eventRepository.delete(otherEvent);
            otherEvents.remove(otherEvent);
            affectedTimelineDayIds.add(otherTimelineDayId);
            affectedTimelineDayIds.add(placeEvent.getTimelineDayId());
        }
    }

    private void attachNewPhotos(Event event, LocationPlace place, List<Photo> photos, Set<UUID> linkedPhotoIds, Instant now) {
        List<Photo> targetPhotos = photos.stream()
                .filter(photo -> !linkedPhotoIds.contains(photo.getPhotoId()))
                .filter(photo -> isWithin(place, effectivePhotoTime(photo)))
                .sorted(Comparator.comparing(this::effectivePhotoTime))
                .toList();
        if (targetPhotos.isEmpty()) {
            return;
        }

        int nextSortOrder = Math.toIntExact(eventPhotoRepository.countByEventId(event.getEventId())) + 1;
        boolean hasRepresentative = eventPhotoRepository.countByEventId(event.getEventId()) > 0;
        for (Photo photo : targetPhotos) {
            EventPhoto eventPhoto = EventPhoto.builder()
                    .eventPhotoId(UUID.randomUUID())
                    .eventId(event.getEventId())
                    .photoId(photo.getPhotoId())
                    .sortOrder(nextSortOrder++)
                    .representative(!hasRepresentative)
                    .createdAt(now)
                    .build();
            eventPhotoRepository.save(eventPhoto);
            linkedPhotoIds.add(photo.getPhotoId());
            hasRepresentative = true;
        }
    }

    private Event createPlaceVisitEvent(UUID tripId, UUID timelineDayId, LocationPlace place, Instant now) {
        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDayId)
                .createdBy(EventCreatedBy.SYSTEM)
                .eventType(EventType.PLACE_VISIT)
                .title(null)
                .placeName(null)
                .placeExternalId(place.getPlaceId().toString())
                .startAt(place.getStartedAt())
                .endAt(place.getEndedAt())
                .centerLatitude(place.getCenterLatitude())
                .centerLongitude(place.getCenterLongitude())
                .radiusM(null)
                .hidden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void createPhotoOnlyEvents(
            UUID tripId,
            List<Photo> photos,
            Set<UUID> linkedPhotoIds,
            List<Event> otherEvents,
            Set<UUID> affectedTimelineDayIds,
            Instant now
    ) {
        List<Photo> unlinkedPhotos = photos.stream()
                .filter(photo -> !linkedPhotoIds.contains(photo.getPhotoId()))
                .sorted(Comparator.comparing(this::effectivePhotoTime))
                .toList();
        if (unlinkedPhotos.isEmpty()) {
            return;
        }

        List<List<Photo>> groups = splitPhotoGroups(unlinkedPhotos);
        for (List<Photo> group : groups) {
            if (group.isEmpty()) {
                continue;
            }
            Photo firstPhoto = group.get(0);
            Photo lastPhoto = group.get(group.size() - 1);
            Event event = findMatchedOtherEvent(otherEvents, firstPhoto, lastPhoto);
            if (event == null) {
                TimelineDay timelineDay = getOrCreateTimelineDay(tripId, resolveDayDate(effectivePhotoTime(firstPhoto)), now);
                event = Event.builder()
                        .eventId(UUID.randomUUID())
                        .tripId(tripId)
                        .timelineDayId(timelineDay.getTimelineDayId())
                        .createdBy(EventCreatedBy.SYSTEM)
                        .eventType(EventType.OTHER)
                        .title(null)
                        .placeName(null)
                        .placeExternalId(null)
                        .startAt(effectivePhotoTime(firstPhoto))
                        .endAt(effectivePhotoTime(lastPhoto))
                        .centerLatitude(firstPhoto.getExifLatitude())
                        .centerLongitude(firstPhoto.getExifLongitude())
                        .radiusM(null)
                        .hidden(false)
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                eventRepository.save(event);
                otherEvents.add(event);
                affectedTimelineDayIds.add(timelineDay.getTimelineDayId());
            } else {
                UUID originalTimelineDayId = event.getTimelineDayId();
                event.updateBasicInfo(
                        event.getTitle(),
                        event.getPlaceName(),
                        event.getPlaceExternalId(),
                        mergeStartAt(event.getStartAt(), effectivePhotoTime(firstPhoto)),
                        mergeEndAt(event.getEndAt(), effectivePhotoTime(lastPhoto)),
                        mergeCoordinate(event.getCenterLatitude(), firstPhoto.getExifLatitude()),
                        mergeCoordinate(event.getCenterLongitude(), firstPhoto.getExifLongitude()),
                        event.getRadiusM(),
                        event.isHidden(),
                        now
                );
                UUID newTimelineDayId = moveEventIfDayChanged(event, tripId, originalTimelineDayId, now);
                affectedTimelineDayIds.add(originalTimelineDayId);
                affectedTimelineDayIds.add(newTimelineDayId);
            }
            attachPhotoGroup(event, group, linkedPhotoIds, now);
            affectedTimelineDayIds.add(event.getTimelineDayId());
        }
    }

    private Event findMatchedOtherEvent(List<Event> otherEvents, Photo firstPhoto, Photo lastPhoto) {
        Instant groupStartAt = effectivePhotoTime(firstPhoto);
        Instant groupEndAt = effectivePhotoTime(lastPhoto);
        LocalDate groupDay = resolveDayDate(groupStartAt);

        return otherEvents.stream()
                .filter(event -> !isProtectedOtherEvent(event))
                .filter(event -> resolveDayDate(event.getStartAt()).equals(groupDay))
                .filter(event -> isTimeClose(event.getStartAt(), event.getEndAt(), groupStartAt, groupEndAt, PHOTO_EVENT_SPLIT_SECONDS))
                .min(Comparator.comparingLong(event -> timeDistanceSeconds(event.getStartAt(), event.getEndAt(), groupStartAt, groupEndAt)))
                .orElse(null);
    }

    private void attachPhotoGroup(Event event, List<Photo> photos, Set<UUID> linkedPhotoIds, Instant now) {
        Set<UUID> existingPhotoIds = new HashSet<>(eventPhotoRepository.findByEventIdOrderBySortOrderAsc(event.getEventId()).stream()
                .map(EventPhoto::getPhotoId)
                .toList());
        int sortOrder = Math.toIntExact(eventPhotoRepository.countByEventId(event.getEventId())) + 1;
        boolean hasRepresentative = sortOrder > 1;
        for (Photo photo : photos) {
            if (existingPhotoIds.contains(photo.getPhotoId())) {
                continue;
            }
            EventPhoto eventPhoto = EventPhoto.builder()
                    .eventPhotoId(UUID.randomUUID())
                    .eventId(event.getEventId())
                    .photoId(photo.getPhotoId())
                    .sortOrder(sortOrder++)
                    .representative(!hasRepresentative)
                    .createdAt(now)
                    .build();
            eventPhotoRepository.save(eventPhoto);
            linkedPhotoIds.add(photo.getPhotoId());
            hasRepresentative = true;
        }
    }

    private void transferPhotos(Event sourceEvent, Event targetEvent, Set<UUID> linkedPhotoIds, Instant now) {
        List<EventPhoto> sourcePhotos = eventPhotoRepository.findByEventIdOrderBySortOrderAsc(sourceEvent.getEventId());
        Set<UUID> targetPhotoIds = new HashSet<>(eventPhotoRepository.findByEventIdOrderBySortOrderAsc(targetEvent.getEventId()).stream()
                .map(EventPhoto::getPhotoId)
                .toList());
        int nextSortOrder = Math.toIntExact(eventPhotoRepository.countByEventId(targetEvent.getEventId())) + 1;
        boolean hasRepresentative = nextSortOrder > 1;

        for (EventPhoto sourcePhoto : sourcePhotos) {
            if (targetPhotoIds.contains(sourcePhoto.getPhotoId())) {
                continue;
            }
            eventPhotoRepository.save(EventPhoto.builder()
                    .eventPhotoId(UUID.randomUUID())
                    .eventId(targetEvent.getEventId())
                    .photoId(sourcePhoto.getPhotoId())
                    .sortOrder(nextSortOrder++)
                    .representative(!hasRepresentative)
                    .createdAt(now)
                    .build());
            linkedPhotoIds.add(sourcePhoto.getPhotoId());
            hasRepresentative = true;
        }
    }

    private List<List<Photo>> splitPhotoGroups(List<Photo> photos) {
        List<List<Photo>> groups = new ArrayList<>();
        List<Photo> currentGroup = new ArrayList<>();
        Instant previousTime = null;

        for (Photo photo : photos) {
            Instant currentTime = effectivePhotoTime(photo);
            if (previousTime != null && Math.abs(currentTime.getEpochSecond() - previousTime.getEpochSecond()) > PHOTO_EVENT_SPLIT_SECONDS) {
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

    private UUID moveEventIfDayChanged(Event event, UUID tripId, UUID originalTimelineDayId, Instant now) {
        LocalDate originalDay = timelineDayRepository.findById(originalTimelineDayId)
                .map(TimelineDay::getDayDate)
                .orElse(resolveDayDate(event.getStartAt()));
        LocalDate newDay = resolveDayDate(event.getStartAt());
        if (originalDay.equals(newDay)) {
            return originalTimelineDayId;
        }

        TimelineDay targetTimelineDay = getOrCreateTimelineDay(tripId, newDay, now);
        event.moveToTimelineDay(targetTimelineDay.getTimelineDayId(), now);
        return targetTimelineDay.getTimelineDayId();
    }

    private TimelineDay getOrCreateTimelineDay(UUID tripId, LocalDate dayDate, Instant now) {
        return timelineDayRepository.findByTripIdAndDayDate(tripId, dayDate)
                .orElseGet(() -> timelineDayRepository.save(TimelineDay.builder()
                        .timelineDayId(UUID.randomUUID())
                        .tripId(tripId)
                        .dayDate(dayDate)
                        .summaryText(null)
                        .distanceM(null)
                        .photoCount(0)
                        .eventCount(0)
                        .createdAt(now)
                        .updatedAt(now)
                        .build()));
    }

    private void recalculateTimelineDayCounts(UUID timelineDayId, Instant now) {
        TimelineDay timelineDay = timelineDayRepository.findById(timelineDayId).orElse(null);
        if (timelineDay == null) {
            return;
        }

        long totalEventCount = eventRepository.countByTimelineDayId(timelineDayId);
        if (totalEventCount == 0) {
            timelineDayRepository.delete(timelineDay);
            return;
        }

        List<Event> visibleEvents = eventRepository.findByTimelineDayIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(timelineDayId);
        long visibleEventCount = visibleEvents.size();
        long visiblePhotoCount = visibleEvents.isEmpty()
                ? 0
                : eventPhotoRepository.findByEventIdInOrderByEventIdAscSortOrderAsc(
                        visibleEvents.stream().map(Event::getEventId).toList())
                .stream()
                .map(EventPhoto::getPhotoId)
                .distinct()
                .count();

        timelineDay.updateSummary(
                timelineDay.getSummaryText(),
                timelineDay.getDistanceM(),
                Math.toIntExact(visiblePhotoCount),
                Math.toIntExact(visibleEventCount),
                now
        );
    }

    private boolean isSameDay(Event event, LocationPlace place) {
        return resolveDayDate(event.getStartAt()).equals(resolveDayDate(place.getStartedAt()));
    }

    private boolean isTimeClose(Event event, LocationPlace place) {
        return isTimeClose(event.getStartAt(), event.getEndAt(), place.getStartedAt(), place.getEndedAt(), MATCH_TIME_GAP_SECONDS);
    }

    private boolean isTimeClose(Instant startAt, Instant endAt, Instant candidateStartAt, Instant candidateEndAt, long allowedGapSeconds) {
        if (!startAt.isAfter(candidateEndAt) && !endAt.isBefore(candidateStartAt)) {
            return true;
        }
        long startGap = Math.abs(startAt.getEpochSecond() - candidateStartAt.getEpochSecond());
        long endGap = Math.abs(endAt.getEpochSecond() - candidateEndAt.getEpochSecond());
        return startGap <= allowedGapSeconds && endGap <= allowedGapSeconds;
    }

    private boolean isDistanceClose(Event event, LocationPlace place) {
        if (event.getCenterLatitude() == null || event.getCenterLongitude() == null) {
            return false;
        }
        return distanceMeters(event, place) <= MATCH_DISTANCE_M;
    }

    private boolean isDistanceCloseOrUnknown(Event event, LocationPlace place) {
        return event.getCenterLatitude() == null || event.getCenterLongitude() == null || isDistanceClose(event, place);
    }

    private long distanceMeters(Event event, LocationPlace place) {
        if (event.getCenterLatitude() == null || event.getCenterLongitude() == null) {
            return Long.MAX_VALUE;
        }
        double lat1 = event.getCenterLatitude().doubleValue();
        double lon1 = event.getCenterLongitude().doubleValue();
        double lat2 = place.getCenterLatitude().doubleValue();
        double lon2 = place.getCenterLongitude().doubleValue();

        double earthRadiusM = 6_371_000d;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(earthRadiusM * c);
    }

    private long distanceMetersOrZero(Event event, LocationPlace place) {
        if (event.getCenterLatitude() == null || event.getCenterLongitude() == null) {
            return 0L;
        }
        return distanceMeters(event, place);
    }

    private boolean isWithin(LocationPlace place, Instant photoTime) {
        return !photoTime.isBefore(place.getStartedAt()) && !photoTime.isAfter(place.getEndedAt());
    }

    private Instant effectivePhotoTime(Photo photo) {
        return photo.getTakenAt() != null ? photo.getTakenAt() : photo.getCreatedAt();
    }

    private LocalDate resolveDayDate(Instant instant) {
        return instant.atZone(DEFAULT_ZONE_ID).toLocalDate();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isProtectedOtherEvent(Event event) {
        return event.getCreatedBy() != EventCreatedBy.SYSTEM
                || eventMemoRepository.existsByEventId(event.getEventId())
                || event.isHidden()
                || hasText(event.getTitle())
                || hasText(event.getPlaceName());
    }

    private long timeDistanceSeconds(Instant startAt, Instant endAt, Instant candidateStartAt, Instant candidateEndAt) {
        long startGap = Math.abs(startAt.getEpochSecond() - candidateStartAt.getEpochSecond());
        long endGap = Math.abs(endAt.getEpochSecond() - candidateEndAt.getEpochSecond());
        return startGap + endGap;
    }

    private Instant mergeStartAt(Instant existingStartAt, Instant incomingStartAt) {
        return existingStartAt.isBefore(incomingStartAt) ? existingStartAt : incomingStartAt;
    }

    private Instant mergeEndAt(Instant existingEndAt, Instant incomingEndAt) {
        return existingEndAt.isAfter(incomingEndAt) ? existingEndAt : incomingEndAt;
    }

    private BigDecimal mergeCoordinate(BigDecimal existingCoordinate, BigDecimal incomingCoordinate) {
        return existingCoordinate != null ? existingCoordinate : incomingCoordinate;
    }
}
