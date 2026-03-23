package com.yeoun.domain.photo.service;

import com.yeoun.domain.photo.dto.request.PhotoUpdateRequest;
import com.yeoun.domain.photo.dto.response.PhotoDetailResponse;
import com.yeoun.domain.photo.dto.response.PhotoDetailMyMemoResponse;
import com.yeoun.domain.photo.dto.response.PhotoUpdateResponse;
import com.yeoun.domain.photo.dto.response.TripPhotoListItemResponse;
import com.yeoun.domain.photo.dto.response.TripPhotoListResponse;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoMemoRepository;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PhotoQueryService {

    private static final int DEFAULT_PHOTO_LIST_LIMIT = 30;
    private static final int MAX_PHOTO_LIST_LIMIT = 100;

    private final PhotoRepository photoRepository;
    private final PhotoMemoRepository photoMemoRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final PhotoProcessingImageUrlService photoProcessingImageUrlService;

    public PhotoQueryService(
            PhotoRepository photoRepository,
            PhotoMemoRepository photoMemoRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            PhotoProcessingImageUrlService photoProcessingImageUrlService
    ) {
        this.photoRepository = photoRepository;
        this.photoMemoRepository = photoMemoRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.photoProcessingImageUrlService = photoProcessingImageUrlService;
    }

    public TripPhotoListResponse getTripPhotos(UUID requesterUserId, UUID tripId, String cursor, int limit) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);

        int safeLimit = normalizeLimit(limit);
        PhotoListCursor decodedCursor = decodeCursor(cursor);
        List<Photo> photos = decodedCursor.isEmpty()
                ? photoRepository.findTripPhotosFirstPage(tripId, safeLimit + 1)
                : photoRepository.findTripPhotosNextPage(
                        tripId,
                        decodedCursor.sortAt(),
                        decodedCursor.photoId(),
                        safeLimit + 1
                );

        boolean hasNext = photos.size() > safeLimit;
        List<Photo> pagePhotos = hasNext
                ? new ArrayList<>(photos.subList(0, safeLimit))
                : photos;

        String nextCursor = null;
        if (hasNext && !pagePhotos.isEmpty()) {
            Photo lastPhoto = pagePhotos.get(pagePhotos.size() - 1);
            nextCursor = encodeCursor(lastPhoto);
        }

        List<TripPhotoListItemResponse> items = pagePhotos.stream()
                .map(this::toTripPhotoListItemResponse)
                .toList();

        return new TripPhotoListResponse(items, nextCursor, hasNext);
    }

    public PhotoDetailResponse getPhotoDetail(UUID requesterUserId, UUID photoId) {
        Photo photo = getAccessiblePhoto(photoId, requesterUserId);
        PhotoDetailMyMemoResponse myMemo = photoMemoRepository.findByPhotoIdAndUserId(photoId, requesterUserId)
                .map(PhotoDetailMyMemoResponse::from)
                .orElse(null);

        return new PhotoDetailResponse(
                photo.getPhotoId(),
                photo.getOwnerUserId(),
                photo.getTripId(),
                photoProcessingImageUrlService.createOriginalUrl(photo.getStorageKey()),
                photoProcessingImageUrlService.createThumbnailUrl(photo.getThumbnailKey()),
                photo.getFileName(),
                photo.getMimeType(),
                photo.getWidth(),
                photo.getHeight(),
                photo.getTakenAt(),
                photo.getTakenTimezone(),
                photo.getExifLatitude(),
                photo.getExifLongitude(),
                photo.isExcluded(),
                myMemo
        );
    }

    @Transactional
    public PhotoUpdateResponse updatePhoto(UUID requesterUserId, UUID photoId, PhotoUpdateRequest request) {
        Photo photo = getAccessiblePhoto(photoId, requesterUserId);
        validatePhotoEditable(requesterUserId, photo);

        Instant now = Instant.now();
        photo.updateExcluded(request.isExcluded(), now);

        return new PhotoUpdateResponse(
                photo.getPhotoId(),
                photo.isExcluded(),
                photo.getUpdatedAt()
        );
    }

    private void validateTripAccessible(UUID requesterUserId, Trip trip) {
        if (trip.getOwnerUserId().equals(requesterUserId)) {
            return;
        }

        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }

    private Photo getAccessiblePhoto(UUID photoId, UUID requesterUserId) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new BaseException(ErrorCode.PHOTO_NOT_FOUND));

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(photo.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);
        return photo;
    }

    private void validatePhotoEditable(UUID requesterUserId, Photo photo) {
        if (photo.getOwnerUserId().equals(requesterUserId)) {
            return;
        }

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(photo.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
        if (trip.getOwnerUserId().equals(requesterUserId)) {
            return;
        }

        throw new BaseException(ErrorCode.PHOTO_FORBIDDEN);
    }

    private TripPhotoListItemResponse toTripPhotoListItemResponse(Photo photo) {
        return new TripPhotoListItemResponse(
                photo.getPhotoId(),
                photoProcessingImageUrlService.createThumbnailUrl(photo.getThumbnailKey()),
                photo.getTakenAt(),
                photo.isExcluded()
        );
    }

    private int normalizeLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_PHOTO_LIST_LIMIT;
        }
        return Math.min(limit, MAX_PHOTO_LIST_LIMIT);
    }

    private PhotoListCursor decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return new PhotoListCursor(null, null);
        }

        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor);
            String raw = new String(decoded, StandardCharsets.UTF_8);
            String[] parts = raw.split("\\|");
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid cursor format");
            }
            Instant sortAt = Instant.parse(parts[0]);
            UUID photoId = UUID.fromString(parts[1]);
            return new PhotoListCursor(sortAt, photoId);
        } catch (Exception exception) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Invalid cursor value.");
        }
    }

    private String encodeCursor(Photo photo) {
        Instant sortAt = resolveSortTime(photo);
        if (sortAt == null || photo.getPhotoId() == null) {
            return null;
        }

        String raw = sortAt + "|" + photo.getPhotoId();
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private Instant resolveSortTime(Photo photo) {
        return photo.getTakenAt() != null ? photo.getTakenAt() : photo.getCreatedAt();
    }

    private record PhotoListCursor(Instant sortAt, UUID photoId) {
        boolean isEmpty() {
            return sortAt == null || photoId == null;
        }
    }
}
