package com.yeoun.domain.settlement.service;

import com.yeoun.domain.settlement.dto.request.SettlementCreateRequest;
import com.yeoun.domain.settlement.dto.response.SettlementCreateResponse;
import com.yeoun.domain.settlement.dto.response.SettlementFinalizeResponse;
import com.yeoun.domain.settlement.entity.Settlement;
import com.yeoun.domain.settlement.entity.SettlementStatus;
import com.yeoun.domain.settlement.repository.SettlementRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional
public class SettlementCommandService {

    private final SettlementCalculationService settlementCalculationService;
    private final SettlementRepository settlementRepository;
    private final TripRepository tripRepository;

    public SettlementCommandService(
            SettlementCalculationService settlementCalculationService,
            SettlementRepository settlementRepository,
            TripRepository tripRepository
    ) {
        this.settlementCalculationService = settlementCalculationService;
        this.settlementRepository = settlementRepository;
        this.tripRepository = tripRepository;
    }

    public SettlementCreateResponse createSettlement(UUID requesterUserId, UUID tripId, SettlementCreateRequest request) {
        SettlementCalculationService.SettlementBuildResult result =
                settlementCalculationService.createDraftSettlement(requesterUserId, tripId, request.note());
        Settlement settlement = result.settlement();
        return new SettlementCreateResponse(
                settlement.getSettlementId(),
                settlement.getTripId(),
                settlement.getVersionNo(),
                settlement.getStatus(),
                settlement.getAlgorithmVersion(),
                settlement.getNote(),
                result.currencyCode(),
                result.memberCount(),
                result.confirmedExpenseCount(),
                result.totalConfirmedAmount(),
                result.transfers().size(),
                settlement.getCreatedByUserId(),
                settlement.getCreatedAt()
        );
    }

    public SettlementFinalizeResponse finalizeSettlement(UUID requesterUserId, UUID settlementId) {
        Settlement target = settlementRepository.findBySettlementId(settlementId)
                .orElseThrow(() -> new BaseException(ErrorCode.SETTLEMENT_NOT_FOUND));

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(target.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        if (!trip.getOwnerUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
        if (target.getStatus() != SettlementStatus.DRAFT) {
            throw new BaseException(ErrorCode.SETTLEMENT_FINALIZE_NOT_ALLOWED);
        }

        Instant now = Instant.now();
        settlementRepository.findByTripIdAndStatus(target.getTripId(), SettlementStatus.FINALIZED)
                .ifPresent(existingFinalized -> {
                    if (!existingFinalized.getSettlementId().equals(target.getSettlementId())) {
                        existingFinalized.supersede(now);
                    }
                });

        target.finalizeSettlement(now);

        return new SettlementFinalizeResponse(
                target.getSettlementId(),
                target.getTripId(),
                target.getVersionNo(),
                target.getStatus(),
                target.getFinalizedAt(),
                target.getUpdatedAt()
        );
    }
}
