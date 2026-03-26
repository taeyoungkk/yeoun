package com.yeoun.domain.sharedalbum.service;

import com.yeoun.domain.settlement.dto.response.SettlementDetailResponse;
import com.yeoun.domain.settlement.dto.response.SettlementListResponse;
import com.yeoun.domain.settlement.service.SettlementQueryService;
import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SharedAlbumSettlementQueryService {

    private final SharedAlbumAccessService sharedAlbumAccessService;
    private final SettlementQueryService settlementQueryService;

    public SharedAlbumSettlementQueryService(
            SharedAlbumAccessService sharedAlbumAccessService,
            SettlementQueryService settlementQueryService
    ) {
        this.sharedAlbumAccessService = sharedAlbumAccessService;
        this.settlementQueryService = settlementQueryService;
    }

    public SettlementListResponse getSettlements(UUID requesterUserId, UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        return settlementQueryService.getTripSettlements(requesterUserId, sharedAlbum.getTripId());
    }

    public SettlementDetailResponse getSettlementDetail(UUID requesterUserId, UUID sharedAlbumId, UUID settlementId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getAccessibleSharedAlbum(sharedAlbumId, requesterUserId);
        return buildSettlementDetail(sharedAlbum, requesterUserId, settlementId);
    }

    public SettlementListResponse getPublicSettlements(UUID sharedAlbumId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbumId);
        return settlementQueryService.getTripSettlements(sharedAlbum.getCreatedByUserId(), sharedAlbum.getTripId());
    }

    public SettlementDetailResponse getPublicSettlementDetail(UUID sharedAlbumId, UUID settlementId) {
        SharedAlbum sharedAlbum = sharedAlbumAccessService.getPublicSharedAlbum(sharedAlbumId);
        return buildSettlementDetail(sharedAlbum, sharedAlbum.getCreatedByUserId(), settlementId);
    }

    private SettlementDetailResponse buildSettlementDetail(SharedAlbum sharedAlbum, UUID requesterUserId, UUID settlementId) {
        SettlementDetailResponse response = settlementQueryService.getSettlementDetail(requesterUserId, settlementId);
        if (!response.tripId().equals(sharedAlbum.getTripId())) {
            throw new BaseException(ErrorCode.SETTLEMENT_NOT_FOUND);
        }
        return response;
    }
}
