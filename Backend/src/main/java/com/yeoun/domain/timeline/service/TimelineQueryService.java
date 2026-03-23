package com.yeoun.domain.timeline.service;

import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
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
import com.yeoun.domain.timeline.repository.EventRepository;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TimelineQueryService {

    private static final Logger log = LoggerFactory.getLogger(TimelineQueryService.class);

    private final TimelineDayRepository timelineDayRepository;
    private final EventRepository eventRepository;
    private final EventPhotoRepository eventPhotoRepository;
    private final EventMemoRepository eventMemoRepository;
    private final PhotoRepository photoRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public TimelineQueryService(
            TimelineDayRepository timelineDayRepository,
            EventRepository eventRepository,
            EventPhotoRepository eventPhotoRepository,
            EventMemoRepository eventMemoRepository,
            PhotoRepository photoRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.timelineDayRepository = timelineDayRepository;
        this.eventRepository = eventRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.eventMemoRepository = eventMemoRepository;
        this.photoRepository = photoRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public TimelineDayListResponse getTimelineDays(UUID requesterUserId, UUID tripId) {
        log.info("Loading timeline days. requesterUserId={}, tripId={}", requesterUserId, tripId);
        Trip trip = getAccessibleTrip(tripId, requesterUserId);

        List<TimelineDayListItemResponse> items = timelineDayRepository.findByTripIdOrderByDayDateAsc(trip.getTripId()).stream()
                .filter(timelineDay -> timelineDay.getEventCount() > 0 || timelineDay.getPhotoCount() > 0)
                .map(timelineDay -> new TimelineDayListItemResponse(
                        timelineDay.getTimelineDayId(),
                        timelineDay.getDayDate(),
                        timelineDay.getSummaryText(),
                        timelineDay.getDistanceM(),
                        timelineDay.getPhotoCount(),
                        timelineDay.getEventCount(),
                        timelineDay.getUpdatedAt()
                ))
                .toList();

        log.info("Loaded timeline days. requesterUserId={}, tripId={}, timelineDayCount={}", requesterUserId, tripId, items.size());
        return new TimelineDayListResponse(items);
    }

    public TimelineDayDetailResponse getTimelineDayDetail(UUID requesterUserId, UUID timelineDayId) {
        log.info("Loading timeline day detail. requesterUserId={}, timelineDayId={}", requesterUserId, timelineDayId);
        TimelineDay timelineDay = timelineDayRepository.findById(timelineDayId)
                .orElseThrow(() -> new BaseException(ErrorCode.TIMELINE_DAY_NOT_FOUND));

        log.info("Resolved timeline day. requesterUserId={}, timelineDayId={}, tripId={}",
                requesterUserId, timelineDayId, timelineDay.getTripId());
        getAccessibleTrip(timelineDay.getTripId(), requesterUserId);

        List<Event> events = eventRepository.findByTimelineDayIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(timelineDayId);
        Map<UUID, List<EventPhotoResponse>> photoResponsesByEventId = buildEventPhotoResponses(events.stream()
                .map(Event::getEventId)
                .toList());

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
                timelineDay.getDistanceM(),
                timelineDay.getPhotoCount(),
                timelineDay.getEventCount(),
                timelineDay.getCreatedAt(),
                timelineDay.getUpdatedAt(),
                eventResponses
        );
    }

    public EventDetailResponse getEventDetail(UUID requesterUserId, UUID eventId) {
        log.info("Loading event detail. requesterUserId={}, eventId={}", requesterUserId, eventId);
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new BaseException(ErrorCode.EVENT_NOT_FOUND));

        getAccessibleTrip(event.getTripId(), requesterUserId);

        List<EventPhotoResponse> photoResponses = buildEventPhotoResponses(List.of(eventId))
                .getOrDefault(eventId, List.of());
        EventMemoSummaryResponse myMemo = eventMemoRepository.findByEventIdAndUserId(eventId, requesterUserId)
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

    private Trip getAccessibleTrip(UUID tripId, UUID requesterUserId) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        boolean isOwner = trip.getOwnerUserId().equals(requesterUserId);
        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                tripId,
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isOwner && !isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
        return trip;
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
}
