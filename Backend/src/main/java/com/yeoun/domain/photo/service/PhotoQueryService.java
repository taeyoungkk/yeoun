package com.yeoun.domain.photo.service;

import com.yeoun.domain.photo.dto.response.TripPhotoListItemResponse;
import com.yeoun.domain.photo.dto.response.TripPhotoListResponse;
import com.yeoun.domain.photo.entity.Photo;
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

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PhotoQueryService {

    private final PhotoRepository photoRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public PhotoQueryService(
            PhotoRepository photoRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.photoRepository = photoRepository;
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

    private TripPhotoListItemResponse toTripPhotoListItemResponse(Photo photo) {
        return new TripPhotoListItemResponse(
                photo.getPhotoId(),
                photo.getThumbnailKey(),
                photo.getTakenAt(),
                photo.getEventId(),
                photo.isExcluded()
        );
    }
}
