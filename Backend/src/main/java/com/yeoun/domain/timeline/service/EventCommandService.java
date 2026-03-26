package com.yeoun.domain.timeline.service;

import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.photo.service.PhotoProcessingImageUrlService;
import com.yeoun.domain.timeline.dto.request.EventPhotoReplaceItemRequest;
import com.yeoun.domain.timeline.dto.request.EventPhotoReplaceRequest;
import com.yeoun.domain.timeline.dto.request.EventUpdateRequest;
import com.yeoun.domain.timeline.dto.response.EventPhotoReplaceResponse;
import com.yeoun.domain.timeline.dto.response.EventPhotoResponse;
import com.yeoun.domain.timeline.dto.response.EventUpdateResponse;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventPhoto;
import com.yeoun.domain.timeline.entity.TimelineDay;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class EventCommandService {

    private static final ZoneId DEFAULT_ZONE_ID = ZoneId.of("Asia/Seoul");

    private final EventRepository eventRepository;
    private final EventPhotoRepository eventPhotoRepository;
    private final TimelineDayRepository timelineDayRepository;
    private final PhotoRepository photoRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final PhotoProcessingImageUrlService photoProcessingImageUrlService;

    public EventCommandService(
            EventRepository eventRepository,
            EventPhotoRepository eventPhotoRepository,
            TimelineDayRepository timelineDayRepository,
            PhotoRepository photoRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            PhotoProcessingImageUrlService photoProcessingImageUrlService
    ) {
        this.eventRepository = eventRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.timelineDayRepository = timelineDayRepository;
        this.photoRepository = photoRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.photoProcessingImageUrlService = photoProcessingImageUrlService;
    }

    public EventUpdateResponse updateEvent(UUID requesterUserId, UUID eventId, EventUpdateRequest request) {
        Event event = getEditableEvent(eventId, requesterUserId);
        Instant originalStartAt = event.getStartAt();
        UUID originalTimelineDayId = event.getTimelineDayId();
        String originalPlaceName = event.getPlaceName();

        Instant startAt = request.startAt() == null ? event.getStartAt() : request.startAt();
        Instant endAt = request.endAt() == null ? event.getEndAt() : request.endAt();
        if (startAt.isAfter(endAt)) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Event startAt must be before or equal to endAt.");
        }
        if (request.radiusM() != null && request.radiusM().signum() < 0) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Event radiusM must be greater than or equal to 0.");
        }

        Instant now = Instant.now();
        event.updateBasicInfo(
                request.title() == null ? event.getTitle() : request.title(),
                request.placeName() == null ? event.getPlaceName() : request.placeName(),
                request.placeExternalId() == null ? event.getPlaceExternalId() : request.placeExternalId(),
                startAt,
                endAt,
                request.centerLatitude() == null ? event.getCenterLatitude() : request.centerLatitude(),
                request.centerLongitude() == null ? event.getCenterLongitude() : request.centerLongitude(),
                request.radiusM() == null ? event.getRadiusM() : request.radiusM(),
                request.hidden() == null ? event.isHidden() : request.hidden(),
                now
        );
        if (request.placeName() != null && !equalsNullable(request.placeName(), originalPlaceName)) {
            event.lockPlaceName(now);
            event.clearPlaceReference(now);
        }

        UUID newTimelineDayId = moveEventIfDayChanged(event, originalStartAt, now);
        recalculateTimelineDayCounts(originalTimelineDayId, now);
        if (!originalTimelineDayId.equals(newTimelineDayId)) {
            recalculateTimelineDayCounts(newTimelineDayId, now);
        }

        return new EventUpdateResponse(
                event.getEventId(),
                event.getTitle(),
                event.getPlaceName(),
                event.getPlaceProvider(),
                event.getProviderPlaceId(),
                event.getPlaceExternalId(),
                event.getStartAt(),
                event.getEndAt(),
                event.getCenterLatitude(),
                event.getCenterLongitude(),
                event.getRadiusM(),
                event.isHidden(),
                event.getUpdatedAt()
        );
    }

    public EventPhotoReplaceResponse replaceEventPhotos(UUID requesterUserId, UUID eventId, EventPhotoReplaceRequest request) {
        Event event = getEditableEvent(eventId, requesterUserId);
        validateReplacePhotosRequest(request);

        List<UUID> photoIds = request.photos().stream()
                .map(EventPhotoReplaceItemRequest::photoId)
                .toList();
        List<Photo> photos = photoRepository.findAllById(photoIds);
        if (photos.size() != photoIds.size()) {
            throw new BaseException(ErrorCode.PHOTO_NOT_FOUND);
        }

        Map<UUID, Photo> photoById = new HashMap<>();
        for (Photo photo : photos) {
            if (!photo.getTripId().equals(event.getTripId())) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "All photos must belong to the same trip as the event.");
            }
            photoById.put(photo.getPhotoId(), photo);
        }

        eventPhotoRepository.deleteByEventId(eventId);
        eventPhotoRepository.flush();

        Instant now = Instant.now();
        List<EventPhotoResponse> responses = new ArrayList<>();
        for (int i = 0; i < request.photos().size(); i++) {
            EventPhotoReplaceItemRequest item = request.photos().get(i);
            Photo photo = photoById.get(item.photoId());
            if (photo == null) {
                throw new BaseException(ErrorCode.PHOTO_NOT_FOUND);
            }

            int sortOrder = i + 1;
            EventPhoto eventPhoto = EventPhoto.builder()
                    .eventPhotoId(UUID.randomUUID())
                    .eventId(eventId)
                    .photoId(photo.getPhotoId())
                    .sortOrder(sortOrder)
                    .representative(item.isRepresentative())
                    .createdAt(now)
                    .build();
            eventPhotoRepository.save(eventPhoto);

            responses.add(new EventPhotoResponse(
                    eventPhoto.getEventPhotoId(),
                    photo.getPhotoId(),
                    photoProcessingImageUrlService.createOriginalUrl(photo.getStorageKey()),
                    photoProcessingImageUrlService.createThumbnailUrl(photo.getThumbnailKey()),
                    photo.getFileName(),
                    photo.getTakenAt(),
                    sortOrder,
                    eventPhoto.isRepresentative()
            ));
        }

        recalculateTimelineDayCounts(event.getTimelineDayId(), now);
        event.updateBasicInfo(
                event.getTitle(),
                event.getPlaceName(),
                event.getPlaceExternalId(),
                event.getStartAt(),
                event.getEndAt(),
                event.getCenterLatitude(),
                event.getCenterLongitude(),
                event.getRadiusM(),
                event.isHidden(),
                now
        );

        return new EventPhotoReplaceResponse(eventId, responses, event.getUpdatedAt());
    }

    private UUID moveEventIfDayChanged(Event event, Instant originalStartAt, Instant now) {
        LocalDate originalDay = resolveDayDate(originalStartAt);
        LocalDate newDay = resolveDayDate(event.getStartAt());
        if (originalDay.equals(newDay)) {
            return event.getTimelineDayId();
        }

        TimelineDay targetTimelineDay = timelineDayRepository.findByTripIdAndDayDate(event.getTripId(), newDay)
                .orElseGet(() -> timelineDayRepository.save(TimelineDay.builder()
                        .timelineDayId(UUID.randomUUID())
                        .tripId(event.getTripId())
                        .dayDate(newDay)
                        .summaryText(null)
                        .distanceM(null)
                        .photoCount(0)
                        .eventCount(0)
                        .createdAt(now)
                        .updatedAt(now)
                        .build()));
        event.moveToTimelineDay(targetTimelineDay.getTimelineDayId(), now);
        return targetTimelineDay.getTimelineDayId();
    }

    private LocalDate resolveDayDate(Instant instant) {
        return instant.atZone(DEFAULT_ZONE_ID).toLocalDate();
    }

    private Event getEditableEvent(UUID eventId, UUID requesterUserId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new BaseException(ErrorCode.EVENT_NOT_FOUND));
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(event.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        boolean isOwner = trip.getOwnerUserId().equals(requesterUserId);
        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isOwner && !isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
        return event;
    }

    private void validateReplacePhotosRequest(EventPhotoReplaceRequest request) {
        Set<UUID> seenPhotoIds = new HashSet<>();
        int representativeCount = 0;
        for (EventPhotoReplaceItemRequest item : request.photos()) {
            if (!seenPhotoIds.add(item.photoId())) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Duplicate photoId is not allowed.");
            }
            if (Boolean.TRUE.equals(item.isRepresentative())) {
                representativeCount++;
            }
        }
        if (representativeCount != 1) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Exactly one representative photo is required.");
        }
    }

    private void recalculateTimelineDayCounts(UUID timelineDayId, Instant now) {
        TimelineDay timelineDay = timelineDayRepository.findById(timelineDayId)
                .orElseThrow(() -> new BaseException(ErrorCode.TIMELINE_DAY_NOT_FOUND));

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

    private boolean equalsNullable(String left, String right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }
}
