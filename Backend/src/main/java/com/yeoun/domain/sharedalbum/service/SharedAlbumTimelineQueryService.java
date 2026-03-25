package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.domain.sharedalbum.entity.SharedAlbumVisibility;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumMemberRepository;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumRepository;
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
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
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
public class SharedAlbumTimelineQueryService {

    private final SharedAlbumRepository sharedAlbumRepository;
    private final SharedAlbumMemberRepository sharedAlbumMemberRepository;
    private final TripRepository tripRepository;
    private final TimelineDayRepository timelineDayRepository;
    private final EventRepository eventRepository;
    private final EventPhotoRepository eventPhotoRepository;
    private final EventMemoRepository eventMemoRepository;
    private final PhotoRepository photoRepository;

    public SharedAlbumTimelineQueryService(
            SharedAlbumRepository sharedAlbumRepository,
            SharedAlbumMemberRepository sharedAlbumMemberRepository,
            TripRepository tripRepository,
            TimelineDayRepository timelineDayRepository,
            EventRepository eventRepository,
            EventPhotoRepository eventPhotoRepository,
            EventMemoRepository eventMemoRepository,
            PhotoRepository photoRepository
    ) {
        this.sharedAlbumRepository = sharedAlbumRepository;
        this.sharedAlbumMemberRepository = sharedAlbumMemberRepository;
        this.tripRepository = tripRepository;
        this.timelineDayRepository = timelineDayRepository;
        this.eventRepository = eventRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.eventMemoRepository = eventMemoRepository;
        this.photoRepository = photoRepository;
    }

    public TimelineDayListResponse getTimelineDays(UUID requesterUserId, UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        List<TimelineDayListItemResponse> items = timelineDayRepository.findByTripIdOrderByDayDateAsc(sharedAlbum.getTripId())
                .stream()
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
        return new TimelineDayListResponse(items);
    }

    public TimelineDayDetailResponse getTimelineDayDetail(UUID requesterUserId, UUID sharedAlbumId, UUID timelineDayId) {
        SharedAlbum sharedAlbum = getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        TimelineDay timelineDay = timelineDayRepository.findById(timelineDayId)
                .orElseThrow(() -> new BaseException(ErrorCode.TIMELINE_DAY_NOT_FOUND));
        if (!timelineDay.getTripId().equals(sharedAlbum.getTripId())) {
            throw new BaseException(ErrorCode.TIMELINE_DAY_NOT_FOUND);
        }

        List<Event> events = eventRepository.findByTimelineDayIdAndHiddenFalseOrderByStartAtAscEndAtAscCreatedAtAsc(timelineDayId);
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
                timelineDay.getDistanceM(),
                timelineDay.getPhotoCount(),
                timelineDay.getEventCount(),
                timelineDay.getCreatedAt(),
                timelineDay.getUpdatedAt(),
                eventResponses
        );
    }

    public EventDetailResponse getEventDetail(UUID requesterUserId, UUID sharedAlbumId, UUID eventId) {
        SharedAlbum sharedAlbum = getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new BaseException(ErrorCode.EVENT_NOT_FOUND));
        if (!event.getTripId().equals(sharedAlbum.getTripId())) {
            throw new BaseException(ErrorCode.EVENT_NOT_FOUND);
        }

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

    private SharedAlbum getAccessibleSharedAlbum(UUID sharedAlbumId, UUID requesterUserId) {
        SharedAlbum sharedAlbum = sharedAlbumRepository.findById(sharedAlbumId)
                .orElseThrow(() -> new BaseException(ErrorCode.SHARED_ALBUM_NOT_FOUND));
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(sharedAlbum.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        if (trip.getOwnerUserId().equals(requesterUserId)) {
            return sharedAlbum;
        }

        if (sharedAlbum.getVisibility() == SharedAlbumVisibility.PUBLIC) {
            return sharedAlbum;
        }

        if (sharedAlbum.getVisibility() == SharedAlbumVisibility.MEMBERS
                && sharedAlbumMemberRepository.existsBySharedAlbumIdAndUserId(sharedAlbumId, requesterUserId)) {
            return sharedAlbum;
        }

        throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
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
