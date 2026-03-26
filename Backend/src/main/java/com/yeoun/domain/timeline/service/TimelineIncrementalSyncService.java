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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class TimelineIncrementalSyncService {

    private static final Logger log = LoggerFactory.getLogger(TimelineIncrementalSyncService.class);
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
    private final EventPlaceResolverService eventPlaceResolverService;

    public TimelineIncrementalSyncService(
            TripRepository tripRepository,
            LocationPlaceRepository locationPlaceRepository,
            PhotoRepository photoRepository,
            EventRepository eventRepository,
            EventPhotoRepository eventPhotoRepository,
            EventMemoRepository eventMemoRepository,
            TimelineDayRepository timelineDayRepository,
            EventPlaceResolverService eventPlaceResolverService
    ) {
        this.tripRepository = tripRepository;
        this.locationPlaceRepository = locationPlaceRepository;
        this.photoRepository = photoRepository;
        this.eventRepository = eventRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.eventMemoRepository = eventMemoRepository;
        this.timelineDayRepository = timelineDayRepository;
        this.eventPlaceResolverService = eventPlaceResolverService;
    }

    public void syncTrip(UUID tripId) {
        log.info("타임라인 증분 동기화를 시작합니다. tripId={}", tripId);
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
        if (trip.getStatus() != TripStatus.ACTIVE && trip.getStatus() != TripStatus.ENDED) {
            log.info("타임라인 증분 동기화를 건너뜁니다. 동기화 가능한 여행 상태가 아닙니다. tripId={}, status={}",
                    tripId, trip.getStatus());
            return;
        }

        Instant now = Instant.now();
        List<LocationPlace> places = locationPlaceRepository.findByTripIdOrderByStartedAtAscUserIdAsc(tripId);
        List<Event> placeEvents = new ArrayList<>(eventRepository.findByTripIdAndEventTypeOrderByStartAtAscEndAtAscCreatedAtAsc(tripId, EventType.PLACE_VISIT));
        List<Event> otherEvents = new ArrayList<>(eventRepository.findByTripIdAndEventTypeOrderByStartAtAscEndAtAscCreatedAtAsc(tripId, EventType.OTHER));
        List<Photo> photos = photoRepository.findByTripIdOrderByTakenAtAscCreatedAtAsc(tripId).stream()
                .filter(photo -> !photo.isExcluded())
                .toList();
        log.info("증분 동기화용 원본 데이터를 불러왔습니다. tripId={}, placeCount={}, placeEventCount={}, otherEventCount={}, photoCount={}",
                tripId, places.size(), placeEvents.size(), otherEvents.size(), photos.size());
        if (places.isEmpty() && photos.isEmpty()) {
            log.info("타임라인 증분 동기화를 건너뜁니다. 위치 로그와 사진이 모두 없습니다. tripId={}", tripId);
            return;
        }
        Set<UUID> linkedPhotoIds = new HashSet<>(eventPhotoRepository.findByPhotoIdIn(photos.stream().map(Photo::getPhotoId).toList())
                .stream()
                .map(EventPhoto::getPhotoId)
                .toList());
        Set<UUID> affectedTimelineDayIds = new HashSet<>();
        Map<UUID, List<LocationPlace>> matchedPlacesByEventId = new HashMap<>();
        Set<UUID> otherEventIdsToRecalculate = new HashSet<>();

        for (LocationPlace place : places) {
            Event matchedEvent = findMatchedEvent(tripId, place, placeEvents);
            if (matchedEvent == null) {
                Event promotedOtherEvent = findPromotableOtherEvent(place, otherEvents);
                if (promotedOtherEvent != null) {
                    UUID originalTimelineDayId = promotedOtherEvent.getTimelineDayId();
                    matchedEvent = promoteOtherEventToPlaceVisit(promotedOtherEvent, tripId, place, now);
                    log.info("증분 동기화 중 OTHER 이벤트를 PLACE_VISIT로 승격했습니다. tripId={}, eventId={}, placeExternalId={}",
                            tripId, matchedEvent.getEventId(), place.getPlaceId());
                    otherEvents.remove(promotedOtherEvent);
                    placeEvents.add(promotedOtherEvent);
                    affectedTimelineDayIds.add(originalTimelineDayId);
                    affectedTimelineDayIds.add(matchedEvent.getTimelineDayId());
                } else {
                    TimelineDay timelineDay = getOrCreateTimelineDay(tripId, resolveDayDate(place.getStartedAt()), now);
                    Event createdEvent = createPlaceVisitEvent(tripId, timelineDay.getTimelineDayId(), place, now);
                    eventRepository.save(createdEvent);
                    log.info("증분 동기화 중 PLACE_VISIT 이벤트를 새로 생성했습니다. tripId={}, eventId={}, timelineDayId={}, placeExternalId={}, placeName={}",
                            tripId, createdEvent.getEventId(), timelineDay.getTimelineDayId(), place.getPlaceId(), createdEvent.getPlaceName());
                    placeEvents.add(createdEvent);
                    matchedEvent = createdEvent;
                    affectedTimelineDayIds.add(timelineDay.getTimelineDayId());
                }
            } else {
                UUID originalTimelineDayId = matchedEvent.getTimelineDayId();
                matchedEvent.updateBasicInfo(
                        matchedEvent.getTitle(),
                        resolvePlaceNameIfMissing(matchedEvent.getPlaceName(), place),
                        matchedEvent.getPlaceExternalId() != null ? matchedEvent.getPlaceExternalId() : place.getPlaceId().toString(),
                        mergeStartAt(matchedEvent.getStartAt(), place.getStartedAt()),
                        mergeEndAt(matchedEvent.getEndAt(), place.getEndedAt()),
                        mergeCoordinate(matchedEvent.getCenterLatitude(), place.getCenterLatitude()),
                        mergeCoordinate(matchedEvent.getCenterLongitude(), place.getCenterLongitude()),
                        matchedEvent.getRadiusM(),
                        matchedEvent.isHidden(),
                        now
                );
                applyResolvedPlaceIfAllowed(matchedEvent, place.getCenterLatitude(), place.getCenterLongitude(), now);
                UUID newTimelineDayId = moveEventIfDayChanged(matchedEvent, tripId, originalTimelineDayId, now);
                log.info("기존 PLACE_VISIT 이벤트에 위치 로그를 병합했습니다. tripId={}, eventId={}, placeExternalId={}, timelineDayId={}",
                        tripId, matchedEvent.getEventId(), place.getPlaceId(), newTimelineDayId);
                affectedTimelineDayIds.add(originalTimelineDayId);
                affectedTimelineDayIds.add(newTimelineDayId);
            }

            matchedPlacesByEventId.computeIfAbsent(matchedEvent.getEventId(), ignored -> new ArrayList<>()).add(place);
            absorbOtherEventsIntoPlaceEvent(matchedEvent, place, otherEvents, linkedPhotoIds, affectedTimelineDayIds, now);
            attachNewPhotos(matchedEvent, place, photos, linkedPhotoIds, now);
        }

        createPhotoOnlyEvents(tripId, photos, linkedPhotoIds, otherEvents, affectedTimelineDayIds, otherEventIdsToRecalculate, now);

        refreshPlaceVisitEventCenters(placeEvents, matchedPlacesByEventId, now);
        refreshOtherEventCenters(otherEvents, otherEventIdsToRecalculate, now);

        for (UUID timelineDayId : affectedTimelineDayIds) {
            recalculateTimelineDayCounts(timelineDayId, now);
        }
        log.info("타임라인 증분 동기화를 완료했습니다. tripId={}, affectedTimelineDayCount={}", tripId, affectedTimelineDayIds.size());
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
                resolvePlaceNameIfMissing(event.getPlaceName(), place),
                place.getPlaceId().toString(),
                mergeStartAt(event.getStartAt(), place.getStartedAt()),
                mergeEndAt(event.getEndAt(), place.getEndedAt()),
                mergeCoordinate(event.getCenterLatitude(), place.getCenterLatitude()),
                mergeCoordinate(event.getCenterLongitude(), place.getCenterLongitude()),
                event.getRadiusM(),
                event.isHidden(),
                now
        );
        applyResolvedPlaceIfAllowed(event, place.getCenterLatitude(), place.getCenterLongitude(), now);
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
        KakaoLocalClient.ResolvedPlace resolvedPlace = resolveResolvedPlace(place.getCenterLatitude(), place.getCenterLongitude())
                .orElse(null);
        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDayId)
                .createdBy(EventCreatedBy.SYSTEM)
                .eventType(EventType.PLACE_VISIT)
                .title(null)
                .placeName(resolvedPlace == null ? null : resolvedPlace.name())
                .placeProvider(resolvedPlace == null ? null : resolvedPlace.provider())
                .providerPlaceId(resolvedPlace == null ? null : resolvedPlace.providerPlaceId())
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
            Set<UUID> otherEventIdsToRecalculate,
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
            BigDecimal centerLatitude = medianCoordinate(group.stream().map(Photo::getExifLatitude).toList());
            BigDecimal centerLongitude = medianCoordinate(group.stream().map(Photo::getExifLongitude).toList());
            Event event = findMatchedOtherEvent(otherEvents, firstPhoto, lastPhoto);
            if (event == null) {
                TimelineDay timelineDay = getOrCreateTimelineDay(tripId, resolveDayDate(effectivePhotoTime(firstPhoto)), now);
                KakaoLocalClient.ResolvedPlace resolvedPlace = resolveResolvedPlace(centerLatitude, centerLongitude).orElse(null);
                event = Event.builder()
                        .eventId(UUID.randomUUID())
                        .tripId(tripId)
                        .timelineDayId(timelineDay.getTimelineDayId())
                        .createdBy(EventCreatedBy.SYSTEM)
                        .eventType(EventType.OTHER)
                        .title(null)
                        .placeName(resolvedPlace == null ? null : resolvedPlace.name())
                        .placeProvider(resolvedPlace == null ? null : resolvedPlace.provider())
                        .providerPlaceId(resolvedPlace == null ? null : resolvedPlace.providerPlaceId())
                        .placeExternalId(null)
                        .startAt(effectivePhotoTime(firstPhoto))
                        .endAt(effectivePhotoTime(lastPhoto))
                        .centerLatitude(centerLatitude)
                        .centerLongitude(centerLongitude)
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
            otherEventIdsToRecalculate.add(event.getEventId());
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

    private String resolvePlaceName(LocationPlace place) {
        return resolveResolvedPlace(place.getCenterLatitude(), place.getCenterLongitude())
                .map(KakaoLocalClient.ResolvedPlace::name)
                .orElse(null);
    }

    private String resolvePlaceNameIfMissing(String existingPlaceName, LocationPlace place) {
        if (hasText(existingPlaceName)) {
            return existingPlaceName;
        }
        return resolvePlaceName(place);
    }

    private Optional<KakaoLocalClient.ResolvedPlace> resolveResolvedPlace(BigDecimal latitude, BigDecimal longitude) {
        return eventPlaceResolverService.resolveResolvedPlace(latitude, longitude);
    }

    private void applyResolvedPlaceIfAllowed(Event event, BigDecimal latitude, BigDecimal longitude, Instant now) {
        if (event.isPlaceNameLocked()) {
            log.info("장소명이 수동 잠금 상태라 자동 재추론을 건너뜁니다. eventId={}, eventType={}",
                    event.getEventId(), event.getEventType());
            return;
        }
        Optional<KakaoLocalClient.ResolvedPlace> resolvedPlace = resolveResolvedPlace(latitude, longitude);
        if (resolvedPlace.isPresent()) {
            event.updatePlaceReference(
                    resolvedPlace.get().provider(),
                    resolvedPlace.get().providerPlaceId(),
                    now
            );
            log.info("이벤트에 자동 추론된 장소 참조를 반영했습니다. eventId={}, eventType={}, placeName={}, placeProvider={}, providerPlaceId={}, source={}, distanceMeters={}",
                    event.getEventId(), event.getEventType(), resolvedPlace.get().name(), resolvedPlace.get().provider(),
                    resolvedPlace.get().providerPlaceId(), resolvedPlace.get().source(), resolvedPlace.get().distanceMeters());
            return;
        }
        log.warn("이벤트에 대한 장소 추론 결과가 없어 provider 참조를 비웁니다. eventId={}, eventType={}, lat={}, lon={}",
                event.getEventId(), event.getEventType(), latitude, longitude);
        event.clearPlaceReference(now);
    }

    private void refreshPlaceVisitEventCenters(List<Event> placeEvents, Map<UUID, List<LocationPlace>> matchedPlacesByEventId, Instant now) {
        Map<UUID, Event> eventById = new HashMap<>();
        for (Event event : placeEvents) {
            eventById.put(event.getEventId(), event);
        }

        for (Map.Entry<UUID, List<LocationPlace>> entry : matchedPlacesByEventId.entrySet()) {
            Event event = eventById.get(entry.getKey());
            if (event == null) {
                continue;
            }
            BigDecimal centerLatitude = medianCoordinate(entry.getValue().stream()
                    .map(LocationPlace::getCenterLatitude)
                    .toList());
            BigDecimal centerLongitude = medianCoordinate(entry.getValue().stream()
                    .map(LocationPlace::getCenterLongitude)
                    .toList());
            String resolvedPlaceName = event.isPlaceNameLocked()
                    ? event.getPlaceName()
                    : eventPlaceResolverService.resolvePlaceName(centerLatitude, centerLongitude).orElse(event.getPlaceName());
            event.updateBasicInfo(
                    event.getTitle(),
                    resolvedPlaceName,
                    event.getPlaceExternalId(),
                    event.getStartAt(),
                    event.getEndAt(),
                    centerLatitude,
                    centerLongitude,
                    event.getRadiusM(),
                    event.isHidden(),
                    now
            );
            log.info("PLACE_VISIT 이벤트 중심 좌표를 재계산했습니다. eventId={}, placeExternalId={}, centerLatitude={}, centerLongitude={}, placeName={}",
                    event.getEventId(), event.getPlaceExternalId(), centerLatitude, centerLongitude, resolvedPlaceName);
            applyResolvedPlaceIfAllowed(event, centerLatitude, centerLongitude, now);
        }
    }

    private void refreshOtherEventCenters(List<Event> otherEvents, Set<UUID> otherEventIdsToRecalculate, Instant now) {
        if (otherEventIdsToRecalculate.isEmpty()) {
            return;
        }
        Map<UUID, Event> eventById = new HashMap<>();
        for (Event event : otherEvents) {
            eventById.put(event.getEventId(), event);
        }

        for (UUID eventId : otherEventIdsToRecalculate) {
            Event event = eventById.get(eventId);
            if (event == null) {
                continue;
            }
            List<Photo> linkedPhotos = getLinkedPhotos(eventId);
            BigDecimal centerLatitude = medianCoordinate(linkedPhotos.stream()
                    .map(Photo::getExifLatitude)
                    .toList());
            BigDecimal centerLongitude = medianCoordinate(linkedPhotos.stream()
                    .map(Photo::getExifLongitude)
                    .toList());
            String resolvedPlaceName = event.isPlaceNameLocked()
                    ? event.getPlaceName()
                    : eventPlaceResolverService.resolvePlaceName(centerLatitude, centerLongitude).orElse(null);
            event.updateBasicInfo(
                    event.getTitle(),
                    resolvedPlaceName,
                    event.getPlaceExternalId(),
                    event.getStartAt(),
                    event.getEndAt(),
                    centerLatitude,
                    centerLongitude,
                    event.getRadiusM(),
                    event.isHidden(),
                    now
            );
            log.info("OTHER 이벤트 중심 좌표를 재계산했습니다. eventId={}, centerLatitude={}, centerLongitude={}, placeName={}",
                    event.getEventId(), centerLatitude, centerLongitude, resolvedPlaceName);
            applyResolvedPlaceIfAllowed(event, centerLatitude, centerLongitude, now);
        }
    }

    private List<Photo> getLinkedPhotos(UUID eventId) {
        List<EventPhoto> eventPhotos = eventPhotoRepository.findByEventIdOrderBySortOrderAsc(eventId);
        if (eventPhotos.isEmpty()) {
            return List.of();
        }
        Map<UUID, Photo> photoById = new HashMap<>();
        for (Photo photo : photoRepository.findAllById(eventPhotos.stream().map(EventPhoto::getPhotoId).toList())) {
            photoById.put(photo.getPhotoId(), photo);
        }
        List<Photo> orderedPhotos = new ArrayList<>();
        for (EventPhoto eventPhoto : eventPhotos) {
            Photo photo = photoById.get(eventPhoto.getPhotoId());
            if (photo != null) {
                orderedPhotos.add(photo);
            }
        }
        return orderedPhotos;
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
                .divide(BigDecimal.valueOf(2), 7, RoundingMode.HALF_UP);
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
                || event.isPlaceNameLocked();
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
