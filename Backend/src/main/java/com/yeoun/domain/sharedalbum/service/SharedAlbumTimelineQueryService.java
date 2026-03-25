package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.locationlog.entity.LocationRouteDay;
import com.yeoun.domain.locationlog.repository.LocationRouteDayRepository;
import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.domain.timeline.dto.response.EventDetailResponse;
import com.yeoun.domain.timeline.dto.response.EventMemoSummaryResponse;
import com.yeoun.domain.timeline.dto.response.EventPhotoResponse;
import com.yeoun.domain.timeline.dto.response.TimelineDayDetailResponse;
import com.yeoun.domain.timeline.dto.response.TimelineDayListItemResponse;
import com.yeoun.domain.timeline.dto.response.TimelineDayListResponse;
import com.yeoun.domain.timeline.dto.response.TimelineEventSummaryResponse;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventMemo;
import com.yeoun.domain.timeline.entity.EventPhoto;
import com.yeoun.domain.timeline.entity.TimelineDay;
import com.yeoun.domain.timeline.repository.EventMemoRepository;
import com.yeoun.domain.timeline.repository.EventPhotoRepository;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class SharedAlbumTimelineQueryService {

    private final SharedAlbumAccessService sharedAlbumAccessService;
    private final SharedAlbumEventSelectionService sharedAlbumEventSelectionService;
    private final TimelineDayRepository timelineDayRepository;
    private final LocationRouteDayRepository locationRouteDayRepository;
    private final EventPhotoRepository eventPhotoRepository;
    private final EventMemoRepository eventMemoRepository;
    private final PhotoRepository photoRepository;

    public SharedAlbumTimelineQueryService(
            SharedAlbumAccessService sharedAlbumAccessService,
            SharedAlbumEventSelectionService sharedAlbumEventSelectionService,
            TimelineDayRepository timelineDayRepository,
            LocationRouteDayRepository locationRouteDayRepository,
            EventPhotoRepository eventPhotoRepository,
            EventMemoRepository eventMemoRepository,
            PhotoRepository photoRepository
    ) {
        this.sharedAlbumAccessService = sharedAlbumAccessService;
        this.sharedAlbumEventSelectionService = sharedAlbumEventSelectionService;
        this.timelineDayRepository = timelineDayRepository;
        this.locationRouteDayRepository = locationRouteDayRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.eventMemoRepository = eventMemoRepository;
        this.photoRepository = photoRepository;
    }

    public TimelineDayListResponse getTimelineDays(UUID requesterUserId, UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        return buildTimelineDays(sharedAlbum);
    }

    public TimelineDayDetailResponse getTimelineDayDetail(UUID requesterUserId, UUID sharedAlbumId, UUID timelineDayId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        return buildTimelineDayDetail(sharedAlbum, timelineDayId);
    }

    public EventDetailResponse getEventDetail(UUID requesterUserId, UUID sharedAlbumId, UUID eventId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        return buildEventDetail(sharedAlbum, eventId, requesterUserId);
    }

    public TimelineDayListResponse getPublicTimelineDays(UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbumId);
        return buildTimelineDays(sharedAlbum);
    }

    public TimelineDayDetailResponse getPublicTimelineDayDetail(UUID sharedAlbumId, UUID timelineDayId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbumId);
        return buildTimelineDayDetail(sharedAlbum, timelineDayId);
    }

    public EventDetailResponse getPublicEventDetail(UUID sharedAlbumId, UUID eventId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbumId);
        return buildEventDetail(sharedAlbum, eventId, null);
    }

    private TimelineDayListResponse buildTimelineDays(SharedAlbum sharedAlbum) {
        List<TimelineDay> timelineDays = timelineDayRepository.findByTripIdOrderByDayDateAsc(sharedAlbum.getTripId());
        Map<UUID, Integer> eventCountByDayId = buildEventCountByDayId(sharedAlbum);
        Map<UUID, BigDecimal> distanceByDayId = buildDistanceByDayId(sharedAlbum, timelineDays);

        List<TimelineDayListItemResponse> items = timelineDays.stream()
                .filter(timelineDay -> eventCountByDayId.getOrDefault(timelineDay.getTimelineDayId(), 0) > 0
                        || timelineDay.getPhotoCount() > 0)
                .map(timelineDay -> new TimelineDayListItemResponse(
                        timelineDay.getTimelineDayId(),
                        timelineDay.getDayDate(),
                        timelineDay.getSummaryText(),
                        distanceByDayId.getOrDefault(timelineDay.getTimelineDayId(), zeroDistance()),
                        timelineDay.getPhotoCount(),
                        eventCountByDayId.getOrDefault(timelineDay.getTimelineDayId(), 0),
                        timelineDay.getUpdatedAt()
                ))
                .toList();
        return new TimelineDayListResponse(items);
    }

    private TimelineDayDetailResponse buildTimelineDayDetail(SharedAlbum sharedAlbum, UUID timelineDayId) {
        TimelineDay timelineDay = timelineDayRepository.findById(timelineDayId)
                .orElseThrow(() -> new BaseException(ErrorCode.TIMELINE_DAY_NOT_FOUND));
        if (!timelineDay.getTripId().equals(sharedAlbum.getTripId())) {
            throw new BaseException(ErrorCode.TIMELINE_DAY_NOT_FOUND);
        }

        List<Event> events = resolveTimelineDayEvents(sharedAlbum, timelineDayId);
        BigDecimal distance = resolveTimelineDayDistance(sharedAlbum, timelineDay);
        Map<UUID, List<EventPhotoResponse>> photoResponsesByEventId = buildEventPhotoResponses(
                events.stream().map(Event::getEventId).toList()
        );

        List<TimelineEventSummaryResponse> eventResponses = events.stream()
                .map(event -> {
                    List<EventPhotoResponse> photos = photoResponsesByEventId.getOrDefault(event.getEventId(), List.of());
                    EventPhotoResponse representativePhoto = photos.stream()
                            .filter(EventPhotoResponse::representative)
                            .findFirst()
                            .orElse(photos.isEmpty() ? null : photos.get(0));
                    return new TimelineEventSummaryResponse(
                            event.getEventId(),
                            event.getCreatedBy(),
                            event.getEventType(),
                            event.getTitle(),
                            event.getPlaceName(),
                            event.getStartAt(),
                            event.getEndAt(),
                            event.isHidden(),
                            photos.size(),
                            representativePhoto
                    );
                })
                .toList();

        return new TimelineDayDetailResponse(
                timelineDay.getTimelineDayId(),
                timelineDay.getTripId(),
                timelineDay.getDayDate(),
                timelineDay.getSummaryText(),
                distance,
                timelineDay.getPhotoCount(),
                eventResponses.size(),
                timelineDay.getCreatedAt(),
                timelineDay.getUpdatedAt(),
                eventResponses
        );
    }

    private EventDetailResponse buildEventDetail(SharedAlbum sharedAlbum, UUID eventId, UUID requesterUserId) {
        Event event = resolveAlbumEvent(sharedAlbum, eventId);

        List<EventPhotoResponse> photoResponses = buildEventPhotoResponses(List.of(eventId))
                .getOrDefault(eventId, List.of());
        EventMemoSummaryResponse myMemo = requesterUserId == null
                ? null
                : eventMemoRepository.findByEventIdAndUserId(eventId, requesterUserId)
                        .map(this::toEventMemoSummaryResponse)
                        .orElse(null);

        return new EventDetailResponse(
                event.getEventId(),
                event.getTripId(),
                event.getTimelineDayId(),
                event.getCreatedBy(),
                event.getEventType(),
                event.getTitle(),
                event.getPlaceName(),
                event.getPlaceExternalId(),
                event.getStartAt(),
                event.getEndAt(),
                event.getCenterLatitude(),
                event.getCenterLongitude(),
                event.getRadiusM(),
                event.isHidden(),
                event.getCreatedAt(),
                event.getUpdatedAt(),
                photoResponses,
                myMemo
        );
    }

    private Map<UUID, Integer> buildEventCountByDayId(SharedAlbum sharedAlbum) {
        Map<UUID, Integer> eventCountByDayId = new LinkedHashMap<>();
        for (Event event : sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum)) {
            eventCountByDayId.merge(event.getTimelineDayId(), 1, Integer::sum);
        }
        return eventCountByDayId;
    }

    private Map<UUID, BigDecimal> buildDistanceByDayId(SharedAlbum sharedAlbum, List<TimelineDay> timelineDays) {
        Map<java.time.LocalDate, UUID> timelineDayIdByDate = new LinkedHashMap<>();
        for (TimelineDay timelineDay : timelineDays) {
            timelineDayIdByDate.put(timelineDay.getDayDate(), timelineDay.getTimelineDayId());
        }

        Map<UUID, BigDecimal> distances = new LinkedHashMap<>();
        for (LocationRouteDay routeDay : locationRouteDayRepository.findByTripIdOrderByDayAscUserIdAsc(sharedAlbum.getTripId())) {
            if (!sharedAlbum.getCreatedByUserId().equals(routeDay.getUserId())) {
                continue;
            }
            UUID timelineDayId = timelineDayIdByDate.get(routeDay.getDay());
            if (timelineDayId == null || routeDay.getDistanceM() == null) {
                continue;
            }
            distances.put(timelineDayId, normalizeDistance(routeDay.getDistanceM()));
        }
        return distances;
    }

    private BigDecimal resolveTimelineDayDistance(SharedAlbum sharedAlbum, TimelineDay timelineDay) {
        for (LocationRouteDay routeDay : locationRouteDayRepository.findByTripIdAndDayOrderByUserIdAsc(
                sharedAlbum.getTripId(),
                timelineDay.getDayDate()
        )) {
            if (sharedAlbum.getCreatedByUserId().equals(routeDay.getUserId()) && routeDay.getDistanceM() != null) {
                return normalizeDistance(routeDay.getDistanceM());
            }
        }
        return zeroDistance();
    }

    private List<Event> resolveTimelineDayEvents(SharedAlbum sharedAlbum, UUID timelineDayId) {
        List<Event> results = new ArrayList<>();
        for (Event event : sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum)) {
            if (timelineDayId.equals(event.getTimelineDayId())) {
                results.add(event);
            }
        }
        return results;
    }

    private Event resolveAlbumEvent(SharedAlbum sharedAlbum, UUID eventId) {
        return sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum)
                .stream()
                .filter(event -> event.getEventId().equals(eventId))
                .findFirst()
                .orElseThrow(() -> new BaseException(ErrorCode.EVENT_NOT_FOUND));
    }

    private Map<UUID, List<EventPhotoResponse>> buildEventPhotoResponses(List<UUID> eventIds) {
        if (eventIds.isEmpty()) {
            return Map.of();
        }

        List<EventPhoto> eventPhotos = eventPhotoRepository.findByEventIdInOrderByEventIdAscSortOrderAsc(eventIds);
        if (eventPhotos.isEmpty()) {
            return Map.of();
        }

        Map<UUID, Photo> photoById = photoRepository.findAllById(eventPhotos.stream()
                        .map(EventPhoto::getPhotoId)
                        .distinct()
                        .toList())
                .stream()
                .collect(Collectors.toMap(Photo::getPhotoId, Function.identity()));

        Map<UUID, List<EventPhotoResponse>> responsesByEventId = new LinkedHashMap<>();
        for (EventPhoto eventPhoto : eventPhotos) {
            Photo photo = photoById.get(eventPhoto.getPhotoId());
            if (photo == null) {
                continue;
            }
            responsesByEventId.computeIfAbsent(eventPhoto.getEventId(), ignored -> new ArrayList<>())
                    .add(toEventPhotoResponse(eventPhoto, photo));
        }

        responsesByEventId.values()
                .forEach(list -> list.sort(Comparator.comparingInt(EventPhotoResponse::sortOrder)));
        return responsesByEventId;
    }

    private EventPhotoResponse toEventPhotoResponse(EventPhoto eventPhoto, Photo photo) {
        return new EventPhotoResponse(
                eventPhoto.getEventPhotoId(),
                photo.getPhotoId(),
                photo.getStorageKey(),
                photo.getThumbnailKey(),
                photo.getFileName(),
                photo.getTakenAt(),
                eventPhoto.getSortOrder(),
                eventPhoto.isRepresentative()
        );
    }

    private EventMemoSummaryResponse toEventMemoSummaryResponse(EventMemo eventMemo) {
        return new EventMemoSummaryResponse(
                eventMemo.getEventMemoId(),
                eventMemo.getEventId(),
                eventMemo.getUserId(),
                eventMemo.getContent(),
                eventMemo.getCreatedAt(),
                eventMemo.getUpdatedAt()
        );
    }

    private BigDecimal normalizeDistance(BigDecimal value) {
        return value.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private BigDecimal zeroDistance() {
        return BigDecimal.ZERO.setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
