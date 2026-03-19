package com.yeoun.domain.timeline.service;

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
import java.util.UUID;

@Service
@Transactional
public class TimelineBuildService {

    private static final Duration EVENT_SPLIT_THRESHOLD = Duration.ofHours(2);
    private static final ZoneId DEFAULT_ZONE_ID = ZoneId.of("Asia/Seoul");

    private final TripRepository tripRepository;
    private final PhotoRepository photoRepository;
    private final TimelineDayRepository timelineDayRepository;
    private final EventRepository eventRepository;
    private final EventPhotoRepository eventPhotoRepository;
    private final TripProcessingStatusService tripProcessingStatusService;

    public TimelineBuildService(
            TripRepository tripRepository,
            PhotoRepository photoRepository,
            TimelineDayRepository timelineDayRepository,
            EventRepository eventRepository,
            EventPhotoRepository eventPhotoRepository,
            TripProcessingStatusService tripProcessingStatusService
    ) {
        this.tripRepository = tripRepository;
        this.photoRepository = photoRepository;
        this.timelineDayRepository = timelineDayRepository;
        this.eventRepository = eventRepository;
        this.eventPhotoRepository = eventPhotoRepository;
        this.tripProcessingStatusService = tripProcessingStatusService;
    }

    public TimelineBuildJobResponse buildTimelineFromPhotos(UUID requesterUserId, UUID tripId) {
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

            BuildResult result = rebuildTimeline(tripId, photos, now);
            tripProcessingStatusService.markReady(tripId, now);

            return new TimelineBuildJobResponse(
                    tripId,
                    TripProcessingStatusType.READY,
                    result.timelineDayCount(),
                    result.eventCount(),
                    now,
                    now
            );
        } catch (RuntimeException ex) {
            tripProcessingStatusService.markFailed(tripId, now, ex.getMessage());
            throw ex;
        }
    }

    private BuildResult rebuildTimeline(UUID tripId, List<Photo> photos, Instant now) {
        if (photos.isEmpty()) {
            return new BuildResult(0, 0);
        }

        Map<LocalDate, List<Photo>> photosByDay = new LinkedHashMap<>();
        for (Photo photo : photos) {
            photosByDay.computeIfAbsent(resolveDayDate(photo), ignored -> new ArrayList<>()).add(photo);
        }

        int timelineDayCount = 0;
        int eventCount = 0;

        for (Map.Entry<LocalDate, List<Photo>> entry : photosByDay.entrySet()) {
            List<List<Photo>> eventPhotoGroups = splitIntoEventGroups(entry.getValue());
            TimelineDay timelineDay = TimelineDay.builder()
                    .timelineDayId(UUID.randomUUID())
                    .tripId(tripId)
                    .dayDate(entry.getKey())
                    .summaryText(null)
                    .distanceM((BigDecimal) null)
                    .photoCount(entry.getValue().size())
                    .eventCount(eventPhotoGroups.size())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            timelineDayRepository.save(timelineDay);
            timelineDayCount++;

            for (List<Photo> eventPhotos : eventPhotoGroups) {
                Event event = createEvent(tripId, timelineDay.getTimelineDayId(), eventPhotos, now);
                eventRepository.save(event);
                saveEventPhotos(event.getEventId(), eventPhotos, now);
                eventCount++;
            }
        }

        return new BuildResult(timelineDayCount, eventCount);
    }

    private Event createEvent(UUID tripId, UUID timelineDayId, List<Photo> eventPhotos, Instant now) {
        Photo firstPhoto = eventPhotos.get(0);
        Photo lastPhoto = eventPhotos.get(eventPhotos.size() - 1);

        return Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDayId)
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

    private List<List<Photo>> splitIntoEventGroups(List<Photo> dayPhotos) {
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

    private record BuildResult(int timelineDayCount, int eventCount) {
    }
}
