package com.yeoun.domain.paymentimport.service;

import com.yeoun.domain.paymentimport.dto.response.PaymentImportItemResponse;
import com.yeoun.domain.paymentimport.dto.response.PaymentImportListResponse;
import com.yeoun.domain.paymentimport.entity.PaymentImport;
import com.yeoun.domain.paymentimport.entity.PaymentImportStatus;
import com.yeoun.domain.paymentimport.repository.PaymentImportRepository;
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
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PaymentImportQueryService {

    private static final ZoneId DEFAULT_TRIP_ZONE = ZoneId.of("Asia/Seoul");

    private final PaymentImportRepository paymentImportRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final PaymentImportSyncService paymentImportSyncService;

    public PaymentImportQueryService(
            PaymentImportRepository paymentImportRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            PaymentImportSyncService paymentImportSyncService
    ) {
        this.paymentImportRepository = paymentImportRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.paymentImportSyncService = paymentImportSyncService;
    }

    public PaymentImportListResponse getMyPaymentImports(UUID requesterUserId) {
        paymentImportSyncService.syncMyPaymentImports(requesterUserId);
        List<PaymentImportItemResponse> items = paymentImportRepository
                .findByUserIdAndStatusOrderByApprovedAtDescCreatedAtDesc(requesterUserId, PaymentImportStatus.CANDIDATE)
                .stream()
                .map(this::toItem)
                .toList();
        return new PaymentImportListResponse(items);
    }

    public PaymentImportListResponse getTripPaymentImports(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);
        paymentImportSyncService.syncMyPaymentImports(requesterUserId);

        Instant fromInclusive = trip.getStartDate().atStartOfDay(DEFAULT_TRIP_ZONE).toInstant();
        Instant toExclusive = trip.getEndDate().plusDays(1).atStartOfDay(DEFAULT_TRIP_ZONE).toInstant();

        List<PaymentImportItemResponse> items = paymentImportRepository
                .findByUserIdAndStatusAndApprovedAtGreaterThanEqualAndApprovedAtLessThanOrderByApprovedAtDescCreatedAtDesc(
                        requesterUserId,
                        PaymentImportStatus.CANDIDATE,
                        fromInclusive,
                        toExclusive
                )
                .stream()
                .map(this::toItem)
                .toList();
        return new PaymentImportListResponse(items);
    }

    private PaymentImportItemResponse toItem(PaymentImport paymentImport) {
        return new PaymentImportItemResponse(
                paymentImport.getPaymentImportId(),
                paymentImport.getUserId(),
                paymentImport.getTripId(),
                paymentImport.getMerchantName(),
                paymentImport.getTransactionSummary(),
                paymentImport.getApprovedAmount(),
                paymentImport.getCurrencyCode(),
                paymentImport.getApprovedAt(),
                paymentImport.getCardName(),
                paymentImport.getAccountNo(),
                paymentImport.getApprovalNo(),
                paymentImport.getExternalTransactionUniqueNo(),
                paymentImport.getSourceType(),
                paymentImport.getStatus(),
                paymentImport.getLinkedExpenseId()
        );
    }

    private Trip findNonDeletedTripOrThrow(UUID tripId) {
        return tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
    }

    private void validateTripAccessible(UUID requesterUserId, Trip trip) {
        boolean isOwner = trip.getOwnerUserId().equals(requesterUserId);
        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isOwner && !isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }
}
