package com.yeoun.domain.photo.service;

import com.yeoun.domain.photo.dto.request.PhotoMemoUpsertRequest;
import com.yeoun.domain.photo.dto.response.PhotoMemoResponse;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.entity.PhotoMemo;
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
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PhotoMemoService {

    private final PhotoMemoRepository photoMemoRepository;
    private final PhotoRepository photoRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public PhotoMemoService(
            PhotoMemoRepository photoMemoRepository,
            PhotoRepository photoRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.photoMemoRepository = photoMemoRepository;
        this.photoRepository = photoRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    @Transactional
    public PhotoMemoResponse upsertPhotoMemo(UUID requesterUserId, UUID photoId, PhotoMemoUpsertRequest request) {
        getAccessiblePhoto(photoId, requesterUserId);

        String trimmedContent = request.content().trim();
        if (trimmedContent.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Memo content is required.");
        }
        if (trimmedContent.length() > 1000) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Memo content must be 1000 characters or fewer.");
        }

        PhotoMemo existingMemo = photoMemoRepository.findByPhotoIdAndUserId(photoId, requesterUserId).orElse(null);
        if (existingMemo == null) {
            Instant now = Instant.now();
            PhotoMemo newMemo = PhotoMemo.builder()
                    .photoMemoId(UUID.randomUUID())
                    .photoId(photoId)
                    .userId(requesterUserId)
                    .content(trimmedContent)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            return PhotoMemoResponse.from(photoMemoRepository.save(newMemo));
        }

        if (!existingMemo.getContent().equals(trimmedContent)) {
            existingMemo.updateContent(trimmedContent, Instant.now());
        }
        return PhotoMemoResponse.from(existingMemo);
    }

    public PhotoMemoResponse getPhotoMemo(UUID requesterUserId, UUID photoId) {
        getAccessiblePhoto(photoId, requesterUserId);
        return photoMemoRepository.findByPhotoIdAndUserId(photoId, requesterUserId)
                .map(PhotoMemoResponse::from)
                .orElse(null);
    }

    @Transactional
    public void deletePhotoMemo(UUID requesterUserId, UUID photoId) {
        getAccessiblePhoto(photoId, requesterUserId);
        photoMemoRepository.deleteByPhotoIdAndUserId(photoId, requesterUserId);
    }

    private Photo getAccessiblePhoto(UUID photoId, UUID requesterUserId) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new BaseException(ErrorCode.PHOTO_NOT_FOUND));

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(photo.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);
        return photo;
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
}
