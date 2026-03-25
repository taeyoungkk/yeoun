package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.domain.sharedalbum.entity.SharedAlbumVisibility;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumMemberRepository;
import com.yeoun.domain.sharedalbum.repository.SharedAlbumRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SharedAlbumAccessService {

    private final SharedAlbumRepository sharedAlbumRepository;
    private final SharedAlbumMemberRepository sharedAlbumMemberRepository;
    private final TripRepository tripRepository;

    public SharedAlbumAccessService(
            SharedAlbumRepository sharedAlbumRepository,
            SharedAlbumMemberRepository sharedAlbumMemberRepository,
            TripRepository tripRepository
    ) {
        this.sharedAlbumRepository = sharedAlbumRepository;
        this.sharedAlbumMemberRepository = sharedAlbumMemberRepository;
        this.tripRepository = tripRepository;
    }

    public SharedAlbum getAccessibleSharedAlbum(UUID sharedAlbumId, UUID requesterUserId) {
        SharedAlbum sharedAlbum = sharedAlbumRepository.findById(sharedAlbumId)
                .orElseThrow(() -> new BaseException(ErrorCode.SHARED_ALBUM_NOT_FOUND));
        Trip trip = getTrip(sharedAlbum.getTripId());

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

    public SharedAlbum getPublicSharedAlbum(UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = sharedAlbumRepository.findById(sharedAlbumId)
                .orElseThrow(() -> new BaseException(ErrorCode.SHARED_ALBUM_NOT_FOUND));
        getTrip(sharedAlbum.getTripId());
        if (sharedAlbum.getVisibility() != SharedAlbumVisibility.PUBLIC) {
            throw new BaseException(ErrorCode.FORBIDDEN);
        }
        return sharedAlbum;
    }

    public void validateAlbumAccessible(SharedAlbum sharedAlbum, UUID requesterUserId) {
        getAccessibleSharedAlbum(sharedAlbum.getSharedAlbumId(), requesterUserId);
    }

    private Trip getTrip(UUID tripId) {
        return tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
    }
}
