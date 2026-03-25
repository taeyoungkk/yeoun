package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.locationlog.entity.LocationRouteDay;
import com.yeoun.domain.locationlog.repository.LocationRouteDayRepository;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.photo.service.PhotoProcessingImageUrlService;
import com.yeoun.domain.sharedalbum.dto.request.SharedAlbumEventReplaceRequest;
import com.yeoun.domain.sharedalbum.dto.request.SharedAlbumMemberReplaceRequest;
import com.yeoun.domain.sharedalbum.dto.request.SharedAlbumUpdateRequest;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumCreateResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumDaySummaryResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumEventSelectionResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumMemberItemResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumMemberListResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumSectionAvailabilityResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumSummaryResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumTripResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumTripSummaryResponse;
import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.domain.sharedalbum.entity.SharedAlbumMember;
import com.yeoun.domain.sharedalbum.entity.SharedAlbumVisibility;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumMemberRepository;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumRepository;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.TimelineDay;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;
import com.yeoun.domain.tripprocessing.repository.TripProcessingStatusRepository;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SharedAlbumService {

    private final SharedAlbumRepository sharedAlbumRepository;
    private final SharedAlbumMemberRepository sharedAlbumMemberRepository;
    private final SharedAlbumAccessService sharedAlbumAccessService;
    private final SharedAlbumEventSelectionService sharedAlbumEventSelectionService;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final TimelineDayRepository timelineDayRepository;
    private final LocationRouteDayRepository locationRouteDayRepository;
    private final PhotoRepository photoRepository;
    private final ExpenseRepository expenseRepository;
    private final TripProcessingStatusRepository tripProcessingStatusRepository;
    private final PhotoProcessingImageUrlService photoProcessingImageUrlService;
    private final UserRepository userRepository;

    public SharedAlbumService(
            SharedAlbumRepository sharedAlbumRepository,
            SharedAlbumMemberRepository sharedAlbumMemberRepository,
            SharedAlbumAccessService sharedAlbumAccessService,
            SharedAlbumEventSelectionService sharedAlbumEventSelectionService,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            TimelineDayRepository timelineDayRepository,
            LocationRouteDayRepository locationRouteDayRepository,
            PhotoRepository photoRepository,
            ExpenseRepository expenseRepository,
            TripProcessingStatusRepository tripProcessingStatusRepository,
            PhotoProcessingImageUrlService photoProcessingImageUrlService,
            UserRepository userRepository
    ) {
        this.sharedAlbumRepository = sharedAlbumRepository;
        this.sharedAlbumMemberRepository = sharedAlbumMemberRepository;
        this.sharedAlbumAccessService = sharedAlbumAccessService;
        this.sharedAlbumEventSelectionService = sharedAlbumEventSelectionService;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.timelineDayRepository = timelineDayRepository;
        this.locationRouteDayRepository = locationRouteDayRepository;
        this.photoRepository = photoRepository;
        this.expenseRepository = expenseRepository;
        this.tripProcessingStatusRepository = tripProcessingStatusRepository;
        this.photoProcessingImageUrlService = photoProcessingImageUrlService;
        this.userRepository = userRepository;
    }

    public SharedAlbumTripResponse getSharedAlbumByTrip(UUID requesterUserId, UUID tripId) {
        Trip trip = findAccessibleTrip(requesterUserId, tripId);
        return sharedAlbumRepository.findByTripId(trip.getTripId())
                .map(sharedAlbum -> {
                    sharedAlbumAccessService.validateAlbumAccessible(sharedAlbum, requesterUserId);
                    return new SharedAlbumTripResponse(true, buildSummary(sharedAlbum, trip));
                })
                .orElseGet(() -> new SharedAlbumTripResponse(false, null));
    }

    public SharedAlbumCreateResponse getPublicSharedAlbum(UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbumId);
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(sharedAlbum.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
        return new SharedAlbumCreateResponse(false, buildSummary(sharedAlbum, trip));
    }

    @Transactional
    public SharedAlbumCreateResponse createSharedAlbum(UUID requesterUserId, UUID tripId) {
        Trip trip = findAccessibleTrip(requesterUserId, tripId);
        validateTripOwner(requesterUserId, trip);

        Optional<SharedAlbum> existing = sharedAlbumRepository.findByTripId(trip.getTripId());
        if (existing.isPresent()) {
            return new SharedAlbumCreateResponse(false, buildSummary(existing.get(), trip));
        }

        Instant now = Instant.now();
        UUID coverPhotoId = photoRepository.findFirstByTripIdAndExcludedFalseOrderByTakenAtAscCreatedAtAsc(tripId)
                .map(Photo::getPhotoId)
                .orElse(null);

        SharedAlbum sharedAlbum = SharedAlbum.builder()
                .sharedAlbumId(UUID.randomUUID())
                .tripId(trip.getTripId())
                .title(trip.getTitle())
                .regionLabel(null)
                .description(null)
                .visibility(SharedAlbumVisibility.MEMBERS)
                .coverPhotoId(coverPhotoId)
                .eventSelectionApplied(false)
                .createdByUserId(requesterUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        sharedAlbumRepository.save(sharedAlbum);

        return new SharedAlbumCreateResponse(true, buildSummary(sharedAlbum, trip));
    }

    @Transactional
    public SharedAlbumCreateResponse updateSharedAlbum(
            UUID requesterUserId,
            UUID sharedAlbumId,
            SharedAlbumUpdateRequest request
    ) {
        SharedAlbum sharedAlbum = sharedAlbumRepository.findById(sharedAlbumId)
                .orElseThrow(() -> new BaseException(ErrorCode.SHARED_ALBUM_NOT_FOUND));
        Trip trip = findAccessibleTrip(requesterUserId, sharedAlbum.getTripId());
        validateTripOwner(requesterUserId, trip);

        String title = normalizeRequiredTitle(request.title(), sharedAlbum.getTitle());
        String regionLabel = normalizeOptionalText(request.regionLabel(), 100, sharedAlbum.getRegionLabel());
        String description = normalizeOptionalDescription(request.description(), sharedAlbum.getDescription());
        SharedAlbumVisibility visibility = request.visibility() == null
                ? sharedAlbum.getVisibility()
                : request.visibility();
        UUID coverPhotoId = resolveCoverPhotoId(request.coverPhotoId(), sharedAlbum.getCoverPhotoId(), trip.getTripId());

        sharedAlbum.updateBasicInfo(
                title,
                regionLabel,
                description,
                visibility,
                coverPhotoId,
                Instant.now()
        );

        return new SharedAlbumCreateResponse(false, buildSummary(sharedAlbum, trip));
    }

    public SharedAlbumMemberListResponse getSharedAlbumMembers(UUID requesterUserId, UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = sharedAlbumRepository.findById(sharedAlbumId)
                .orElseThrow(() -> new BaseException(ErrorCode.SHARED_ALBUM_NOT_FOUND));
        Trip trip = findAccessibleTrip(requesterUserId, sharedAlbum.getTripId());
        validateTripOwner(requesterUserId, trip);

        return buildMemberListResponse(sharedAlbumId);
    }

    @Transactional
    public SharedAlbumMemberListResponse replaceSharedAlbumMembers(
            UUID requesterUserId,
            UUID sharedAlbumId,
            SharedAlbumMemberReplaceRequest request
    ) {
        SharedAlbum sharedAlbum = sharedAlbumRepository.findById(sharedAlbumId)
                .orElseThrow(() -> new BaseException(ErrorCode.SHARED_ALBUM_NOT_FOUND));
        Trip trip = findAccessibleTrip(requesterUserId, sharedAlbum.getTripId());
        validateTripOwner(requesterUserId, trip);

        Set<UUID> requestedUserIds = normalizeUserIds(request.userIds());
        Set<UUID> allowedUserIds = new LinkedHashSet<>(tripMemberRepository.findCurrentUserIdsByTripId(trip.getTripId()));
        if (!allowedUserIds.containsAll(requestedUserIds)) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Shared album members must be current trip members.");
        }

        sharedAlbumMemberRepository.deleteBySharedAlbumId(sharedAlbumId);

        Instant now = Instant.now();
        for (UUID userId : requestedUserIds) {
            sharedAlbumMemberRepository.save(SharedAlbumMember.builder()
                    .sharedAlbumMemberId(UUID.randomUUID())
                    .sharedAlbumId(sharedAlbumId)
                    .userId(userId)
                    .createdAt(now)
                    .build());
        }

        return buildMemberListResponse(sharedAlbumId);
    }

    @Transactional
    public SharedAlbumEventSelectionResponse replaceSharedAlbumEvents(
            UUID requesterUserId,
            UUID sharedAlbumId,
            SharedAlbumEventReplaceRequest request
    ) {
        SharedAlbum sharedAlbum = sharedAlbumRepository.findById(sharedAlbumId)
                .orElseThrow(() -> new BaseException(ErrorCode.SHARED_ALBUM_NOT_FOUND));
        Trip trip = findAccessibleTrip(requesterUserId, sharedAlbum.getTripId());
        validateTripOwner(requesterUserId, trip);

        List<UUID> selectedEventIds =
                sharedAlbumEventSelectionService.replaceSelections(sharedAlbumId, trip.getTripId(), request.eventIds());
        sharedAlbum.updateEventSelectionApplied(true, Instant.now());
        return new SharedAlbumEventSelectionResponse(sharedAlbumId, selectedEventIds);
    }

    private SharedAlbumSummaryResponse buildSummary(SharedAlbum sharedAlbum, Trip trip) {
        List<TimelineDay> timelineDays = timelineDayRepository.findByTripIdOrderByDayDateAsc(trip.getTripId());
        Map<UUID, TimelineDay> timelineDayById = new LinkedHashMap<>();
        Map<LocalDate, TimelineDay> timelineDayByDate = new LinkedHashMap<>();
        for (TimelineDay timelineDay : timelineDays) {
            timelineDayById.put(timelineDay.getTimelineDayId(), timelineDay);
            timelineDayByDate.put(timelineDay.getDayDate(), timelineDay);
        }

        List<Event> sharedAlbumEvents = sharedAlbumEventSelectionService.resolveVisibleEvents(sharedAlbum);
        Map<LocalDate, Integer> recordCountByDay = buildRecordCountByDay(sharedAlbumEvents, timelineDayById);
        Map<LocalDate, BigDecimal> distanceByDay = buildDistanceByDay(trip.getTripId(), sharedAlbum.getCreatedByUserId());

        long travelerCount = tripMemberRepository.countByTripIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                TripMemberInviteStatus.ACCEPTED
        );
        BigDecimal totalCost = expenseRepository.sumConfirmedAmountByTripIdAndStatus(
                trip.getTripId(),
                ExpenseStatus.CONFIRMED
        );

        SharedAlbumTripSummaryResponse tripSummary = new SharedAlbumTripSummaryResponse(
                sumDistances(distanceByDay.values()),
                Math.toIntExact(photoRepository.countByTripIdAndExcludedFalse(trip.getTripId())),
                sharedAlbumEvents.size(),
                travelerCount,
                calculateTripDayCount(trip),
                totalCost,
                calculateCostPerTraveler(totalCost, travelerCount)
        );

        List<SharedAlbumDaySummaryResponse> daySummaries =
                buildDaySummaries(trip, timelineDayByDate, distanceByDay, recordCountByDay);

        String coverPhotoUrl = null;
        if (sharedAlbum.getCoverPhotoId() != null) {
            coverPhotoUrl = photoRepository.findById(sharedAlbum.getCoverPhotoId())
                    .map(Photo::getThumbnailKey)
                    .map(photoProcessingImageUrlService::createThumbnailUrl)
                    .orElse(null);
        }

        SharedAlbumSectionAvailabilityResponse sections = new SharedAlbumSectionAvailabilityResponse(
                !sharedAlbumEvents.isEmpty(),
                tripSummary.totalDistanceM().compareTo(BigDecimal.ZERO) > 0,
                totalCost.compareTo(BigDecimal.ZERO) > 0
        );

        TripProcessingStatusType processingStatus = tripProcessingStatusRepository.findById(trip.getTripId())
                .map(status -> status.getStatus())
                .orElse(TripProcessingStatusType.PENDING);

        return new SharedAlbumSummaryResponse(
                sharedAlbum.getSharedAlbumId(),
                sharedAlbum.getTripId(),
                sharedAlbum.getTitle(),
                sharedAlbum.getRegionLabel(),
                sharedAlbum.getDescription(),
                sharedAlbum.getVisibility(),
                sharedAlbum.getCoverPhotoId(),
                coverPhotoUrl,
                trip.getStartDate(),
                trip.getEndDate(),
                tripSummary,
                daySummaries,
                sections,
                processingStatus,
                sharedAlbum.getCreatedAt(),
                sharedAlbum.getUpdatedAt()
        );
    }

    private List<SharedAlbumDaySummaryResponse> buildDaySummaries(
            Trip trip,
            Map<LocalDate, TimelineDay> timelineDayByDate,
            Map<LocalDate, BigDecimal> distanceByDay,
            Map<LocalDate, Integer> recordCountByDay
    ) {
        List<SharedAlbumDaySummaryResponse> results = new ArrayList<>();
        LocalDate cursor = trip.getStartDate();
        int dayNumber = 1;
        while (!cursor.isAfter(trip.getEndDate())) {
            TimelineDay timelineDay = timelineDayByDate.get(cursor);
            results.add(new SharedAlbumDaySummaryResponse(
                    cursor,
                    dayNumber,
                    dayNumber + "일차",
                    distanceByDay.getOrDefault(cursor, zeroDistance()),
                    timelineDay == null ? 0 : timelineDay.getPhotoCount(),
                    recordCountByDay.getOrDefault(cursor, 0)
            ));
            cursor = cursor.plusDays(1);
            dayNumber++;
        }
        return results;
    }

    private Map<LocalDate, BigDecimal> buildDistanceByDay(UUID tripId, UUID userId) {
        Map<LocalDate, BigDecimal> distanceByDay = new LinkedHashMap<>();
        for (LocationRouteDay routeDay : locationRouteDayRepository.findByTripIdOrderByDayAscUserIdAsc(tripId)) {
            if (!userId.equals(routeDay.getUserId())) {
                continue;
            }
            if (routeDay.getDistanceM() == null) {
                continue;
            }
            distanceByDay.merge(routeDay.getDay(), routeDay.getDistanceM(), BigDecimal::add);
        }
        distanceByDay.replaceAll((day, distance) -> normalizeDistance(distance));
        return distanceByDay;
    }

    private Map<LocalDate, Integer> buildRecordCountByDay(List<Event> events, Map<UUID, TimelineDay> timelineDayById) {
        Map<LocalDate, Integer> recordCountByDay = new LinkedHashMap<>();
        for (Event event : events) {
            TimelineDay timelineDay = timelineDayById.get(event.getTimelineDayId());
            if (timelineDay == null) {
                continue;
            }
            recordCountByDay.merge(timelineDay.getDayDate(), 1, Integer::sum);
        }
        return recordCountByDay;
    }

    private BigDecimal sumDistances(Iterable<BigDecimal> distances) {
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal distance : distances) {
            if (distance != null) {
                total = total.add(distance);
            }
        }
        return normalizeDistance(total);
    }

    private BigDecimal calculateCostPerTraveler(BigDecimal totalCost, long travelerCount) {
        if (travelerCount <= 0L) {
            return zeroMoney();
        }
        return totalCost.divide(BigDecimal.valueOf(travelerCount), 2, RoundingMode.HALF_UP);
    }

    private int calculateTripDayCount(Trip trip) {
        return Math.toIntExact(ChronoUnit.DAYS.between(trip.getStartDate(), trip.getEndDate()) + 1L);
    }

    private UUID resolveCoverPhotoId(UUID requestedCoverPhotoId, UUID currentCoverPhotoId, UUID tripId) {
        if (requestedCoverPhotoId == null) {
            return currentCoverPhotoId;
        }

        Photo photo = photoRepository.findById(requestedCoverPhotoId)
                .orElseThrow(() -> new BaseException(ErrorCode.PHOTO_NOT_FOUND));
        if (!photo.getTripId().equals(tripId)) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Cover photo must belong to the same trip.");
        }
        return requestedCoverPhotoId;
    }

    private String normalizeRequiredTitle(String requestedTitle, String currentTitle) {
        if (requestedTitle == null) {
            return currentTitle;
        }
        String trimmed = requestedTitle.trim();
        if (trimmed.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Shared album title must not be blank.");
        }
        return trimmed;
    }

    private String normalizeOptionalText(String requestedValue, int maxLength, String currentValue) {
        if (requestedValue == null) {
            return currentValue;
        }
        String trimmed = requestedValue.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > maxLength) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        return trimmed;
    }

    private String normalizeOptionalDescription(String requestedDescription, String currentDescription) {
        if (requestedDescription == null) {
            return currentDescription;
        }
        String trimmed = requestedDescription.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Set<UUID> normalizeUserIds(List<UUID> userIds) {
        LinkedHashSet<UUID> normalized = new LinkedHashSet<>();
        for (UUID userId : userIds) {
            if (userId != null) {
                normalized.add(userId);
            }
        }
        return normalized;
    }

    private SharedAlbumMemberListResponse buildMemberListResponse(UUID sharedAlbumId) {
        List<SharedAlbumMember> sharedAlbumMembers = sharedAlbumMemberRepository.findBySharedAlbumIdOrderByCreatedAtAsc(sharedAlbumId);
        List<UUID> userIds = sharedAlbumMembers.stream()
                .map(SharedAlbumMember::getUserId)
                .toList();

        Map<UUID, User> userMap = new LinkedHashMap<>();
        for (User user : userRepository.findAllById(userIds)) {
            userMap.put(user.getUserId(), user);
        }

        List<SharedAlbumMemberItemResponse> members = new ArrayList<>();
        for (SharedAlbumMember sharedAlbumMember : sharedAlbumMembers) {
            User user = userMap.get(sharedAlbumMember.getUserId());
            if (user == null) {
                continue;
            }
            members.add(new SharedAlbumMemberItemResponse(
                    user.getUserId(),
                    user.getNickname(),
                    user.getProfileImageUrl()
            ));
        }
        return new SharedAlbumMemberListResponse(sharedAlbumId, members);
    }

    private Trip findAccessibleTrip(UUID requesterUserId, UUID tripId) {
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

    private void validateTripOwner(UUID requesterUserId, Trip trip) {
        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }

    private BigDecimal normalizeDistance(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal zeroDistance() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal zeroMoney() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
