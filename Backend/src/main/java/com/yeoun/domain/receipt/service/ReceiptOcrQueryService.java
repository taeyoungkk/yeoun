package com.yeoun.domain.receipt.service;

import com.yeoun.domain.receipt.dto.response.ReceiptOcrLineItemResponse;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrResultResponse;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrStatusResponse;
import com.yeoun.domain.receipt.entity.ReceiptOcrLineItem;
import com.yeoun.domain.receipt.entity.ReceiptOcrResult;
import com.yeoun.domain.receipt.entity.ReceiptProcessingStatus;
import com.yeoun.domain.receipt.repository.ReceiptOcrLineItemRepository;
import com.yeoun.domain.receipt.repository.ReceiptOcrResultRepository;
import com.yeoun.domain.receipt.repository.ReceiptProcessingStatusRepository;
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
public class ReceiptOcrQueryService {

    private final ReceiptProcessingStatusRepository receiptProcessingStatusRepository;
    private final ReceiptOcrResultRepository receiptOcrResultRepository;
    private final ReceiptOcrLineItemRepository receiptOcrLineItemRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public ReceiptOcrQueryService(
            ReceiptProcessingStatusRepository receiptProcessingStatusRepository,
            ReceiptOcrResultRepository receiptOcrResultRepository,
            ReceiptOcrLineItemRepository receiptOcrLineItemRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.receiptProcessingStatusRepository = receiptProcessingStatusRepository;
        this.receiptOcrResultRepository = receiptOcrResultRepository;
        this.receiptOcrLineItemRepository = receiptOcrLineItemRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public ReceiptOcrStatusResponse getReceiptOcrStatus(UUID requesterUserId, UUID receiptId) {
        ReceiptProcessingStatus status = receiptProcessingStatusRepository.findById(receiptId.toString())
                .orElseThrow(() -> new BaseException(ErrorCode.RECEIPT_OCR_RESULT_NOT_FOUND));

        Trip trip = findNonDeletedTripOrThrow(UUID.fromString(status.getTripId()));
        validateTripAccessible(requesterUserId, trip);

        return new ReceiptOcrStatusResponse(
                UUID.fromString(status.getReceiptId()),
                UUID.fromString(status.getTripId()),
                status.getStatus(),
                status.getAttempt(),
                status.getLastRequestedAt(),
                status.getLastProcessedAt(),
                status.getLastErrorCode(),
                status.getLastErrorMessage(),
                status.getUpdatedAt()
        );
    }

    public ReceiptOcrResultResponse getReceiptOcrResult(UUID requesterUserId, UUID receiptId) {
        ReceiptOcrResult result = receiptOcrResultRepository.findById(receiptId.toString())
                .orElseThrow(() -> new BaseException(ErrorCode.RECEIPT_OCR_RESULT_NOT_FOUND));

        Trip trip = findNonDeletedTripOrThrow(UUID.fromString(result.getTripId()));
        validateTripAccessible(requesterUserId, trip);

        List<ReceiptOcrLineItemResponse> lineItems = receiptOcrLineItemRepository.findByReceiptIdOrderBySortOrderAsc(result.getReceiptId())
                .stream()
                .map(this::toLineItemResponse)
                .toList();

        return new ReceiptOcrResultResponse(
                UUID.fromString(result.getReceiptId()),
                UUID.fromString(result.getTripId()),
                result.getImageUrl(),
                result.getStatus(),
                result.getMerchantName(),
                result.getPaidAtRaw(),
                result.getCurrencyCode(),
                result.getTotalAmount(),
                result.getTaxAmount(),
                lineItems,
                result.getRawText(),
                result.getErrorCode(),
                result.getErrorMessage(),
                result.getAttempt(),
                result.getRequestedAt(),
                result.getProcessedAt()
        );
    }

    private ReceiptOcrLineItemResponse toLineItemResponse(ReceiptOcrLineItem item) {
        return new ReceiptOcrLineItemResponse(
                item.getReceiptOcrLineItemRowId(),
                item.getSortOrder(),
                item.getName(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getAmount()
        );
    }

    private Trip findNonDeletedTripOrThrow(UUID tripId) {
        return tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
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
