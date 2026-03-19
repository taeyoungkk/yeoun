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

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PhotoQueryService {

    private final PhotoRepository photoRepository;
    private final PhotoMemoRepository photoMemoRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public PhotoQueryService(
            PhotoRepository photoRepository,
            PhotoMemoRepository photoMemoRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.photoRepository = photoRepository;
        this.photoMemoRepository = photoMemoRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public TripPhotoListResponse getTripPhotos(UUID requesterUserId, UUID tripId) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);

        List<TripPhotoListItemResponse> items = photoRepository.findByTripIdOrderByTakenAtAscCreatedAtAsc(tripId).stream()
                .map(this::toTripPhotoListItemResponse)
                .toList();

        return new TripPhotoListResponse(items);
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
                photo.getStorageKey(),
                photo.getThumbnailKey(),
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
                photo.getThumbnailKey(),
                photo.getTakenAt(),
                photo.isExcluded()
        );
    }
}
