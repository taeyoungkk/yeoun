package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.settlement.dto.response.SettlementDetailResponse;
import com.yeoun.domain.settlement.dto.response.SettlementListResponse;
import com.yeoun.domain.settlement.service.SettlementQueryService;
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
public class SharedAlbumSettlementQueryService {

    private final SharedAlbumRepository sharedAlbumRepository;
    private final SharedAlbumMemberRepository sharedAlbumMemberRepository;
    private final TripRepository tripRepository;
    private final SettlementQueryService settlementQueryService;

    public SharedAlbumSettlementQueryService(
            SharedAlbumRepository sharedAlbumRepository,
            SharedAlbumMemberRepository sharedAlbumMemberRepository,
            TripRepository tripRepository,
            SettlementQueryService settlementQueryService
    ) {
        this.sharedAlbumRepository = sharedAlbumRepository;
        this.sharedAlbumMemberRepository = sharedAlbumMemberRepository;
        this.tripRepository = tripRepository;
        this.settlementQueryService = settlementQueryService;
    }

    public SettlementListResponse getSettlements(UUID requesterUserId, UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        return settlementQueryService.getTripSettlements(requesterUserId, sharedAlbum.getTripId());
    }

    public SettlementDetailResponse getSettlementDetail(UUID requesterUserId, UUID sharedAlbumId, UUID settlementId) {
        SharedAlbum sharedAlbum = getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        SettlementDetailResponse response = settlementQueryService.getSettlementDetail(requesterUserId, settlementId);
        if (!response.tripId().equals(sharedAlbum.getTripId())) {
            throw new BaseException(ErrorCode.SETTLEMENT_NOT_FOUND);
        }
        return response;
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
}
