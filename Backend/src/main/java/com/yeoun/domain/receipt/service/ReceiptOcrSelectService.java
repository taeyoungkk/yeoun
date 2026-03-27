package com.yeoun.domain.receipt.service;

import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseSourceType;
import com.yeoun.domain.expense.entity.ExpenseSplit;
import com.yeoun.domain.expense.entity.ExpenseSplitType;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.expense.repository.ExpenseSplitRepository;
import com.yeoun.domain.receipt.dto.request.ReceiptOcrSelectRequest;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrSelectResponse;
import com.yeoun.domain.receipt.entity.ReceiptOcrResult;
import com.yeoun.domain.receipt.repository.ReceiptOcrResultRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class ReceiptOcrSelectService {

    private static final String COMPLETED_STATUS = "COMPLETED";
    private static final String SUPPORTED_CURRENCY_CODE = "KRW";

    private final ReceiptOcrResultRepository receiptOcrResultRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public ReceiptOcrSelectService(
            ReceiptOcrResultRepository receiptOcrResultRepository,
            ExpenseRepository expenseRepository,
            ExpenseSplitRepository expenseSplitRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.receiptOcrResultRepository = receiptOcrResultRepository;
        this.expenseRepository = expenseRepository;
        this.expenseSplitRepository = expenseSplitRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public ReceiptOcrSelectResponse selectReceiptOcr(
            UUID requesterUserId,
            UUID receiptId,
            ReceiptOcrSelectRequest request
    ) {
        ReceiptOcrResult receiptOcrResult = receiptOcrResultRepository.findById(receiptId.toString())
                .orElseThrow(() -> new BaseException(ErrorCode.RECEIPT_OCR_RESULT_NOT_FOUND));
        if (!COMPLETED_STATUS.equals(receiptOcrResult.getStatus())) {
            throw new BaseException(ErrorCode.RECEIPT_OCR_SELECTION_NOT_ALLOWED);
        }
        if (expenseRepository.findByReceiptId(receiptOcrResult.getReceiptId()).isPresent()) {
            throw new BaseException(ErrorCode.RECEIPT_OCR_ALREADY_SELECTED);
        }

        UUID tripId = parseTripId(receiptOcrResult.getTripId());
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);

        List<UUID> participantUserIds = normalizeParticipantUserIds(request.lineItems());
        validateUsersAreTripParticipants(tripId, requesterUserId, request.payerUserId(), participantUserIds);

        String merchantName = normalizeRequiredText(receiptOcrResult.getMerchantName());
        String currencyCode = normalizeCurrencyCode(receiptOcrResult.getCurrencyCode());
        BigDecimal totalAmount = validateAndNormalizeAmount(receiptOcrResult.getTotalAmount());
        Instant paidAt = resolvePaidAt(receiptOcrResult);

        Instant now = Instant.now();
        Expense expense = Expense.builder()
                .expenseId(UUID.randomUUID())
                .tripId(tripId)
                .createdByUserId(requesterUserId)
                .payerUserId(request.payerUserId())
                .sourceType(ExpenseSourceType.RECEIPT_OCR)
                .paymentImportId(null)
                .receiptId(receiptOcrResult.getReceiptId())
                .merchantName(merchantName)
                .category(request.category())
                .currencyCode(currencyCode)
                .totalAmount(totalAmount)
                .paidAt(paidAt)
                .memo(normalizeOptionalText(request.memo()))
                .splitType(ExpenseSplitType.EQUAL)
                .status(ExpenseStatus.CONFIRMED)
                .createdAt(now)
                .updatedAt(now)
                .build();
        expenseRepository.save(expense);
        replaceSplits(expense.getExpenseId(), totalAmount, participantUserIds, now);

        return new ReceiptOcrSelectResponse(
                receiptId,
                tripId,
                expense.getExpenseId(),
                expense.getStatus(),
                expense.getCreatedAt()
        );
    }

    private Trip findNonDeletedTripOrThrow(UUID tripId) {
        return tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
    }

    private UUID parseTripId(String tripId) {
        if (tripId == null || tripId.isBlank()) {
            throw new BaseException(ErrorCode.TRIP_NOT_FOUND);
        }
        try {
            return UUID.fromString(tripId);
        } catch (IllegalArgumentException exception) {
            throw new BaseException(ErrorCode.TRIP_NOT_FOUND);
        }
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

    private void validateUsersAreTripParticipants(
            UUID tripId,
            UUID requesterUserId,
            UUID payerUserId,
            List<UUID> participantUserIds
    ) {
        Set<UUID> currentParticipantIds = new LinkedHashSet<>(tripMemberRepository.findCurrentUserIdsByTripId(tripId));

        if (!currentParticipantIds.contains(requesterUserId)) {
            throw new BaseException(ErrorCode.EXPENSE_CREATOR_NOT_IN_TRIP);
        }
        if (!currentParticipantIds.contains(payerUserId)) {
            throw new BaseException(ErrorCode.EXPENSE_PAYER_NOT_IN_TRIP);
        }
        if (!currentParticipantIds.containsAll(participantUserIds)) {
            throw new BaseException(ErrorCode.EXPENSE_PARTICIPANT_NOT_IN_TRIP);
        }
    }

    private List<UUID> normalizeParticipantUserIds(
            List<ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest> lineItems
    ) {
        if (lineItems == null || lineItems.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "At least one line item is required.");
        }
        LinkedHashSet<UUID> deduplicated = new LinkedHashSet<>();
        for (ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest lineItem : lineItems) {
            if (lineItem == null) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Line item cannot be null.");
            }
            if (lineItem.ocrLineItemId() == null) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "OCR line item id is required.");
            }
            validateAndNormalizeAmount(lineItem.amount());
            if (lineItem.participantUserIds() == null || lineItem.participantUserIds().isEmpty()) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "At least one participant is required.");
            }
            for (UUID userId : lineItem.participantUserIds()) {
                if (userId == null) {
                    throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Participant user id cannot be null.");
                }
                deduplicated.add(userId);
            }
        }
        return new ArrayList<>(deduplicated);
    }

    private String normalizeRequiredText(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        return value.trim();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeCurrencyCode(String value) {
        String normalized = normalizeRequiredText(value).toUpperCase();
        if (!SUPPORTED_CURRENCY_CODE.equals(normalized)) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Only KRW is supported for now.");
        }
        return normalized;
    }

    private BigDecimal validateAndNormalizeAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        try {
            return amount.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException ex) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Amount must have up to 2 decimal places.");
        }
    }

    private Instant resolvePaidAt(ReceiptOcrResult receiptOcrResult) {
        String paidAtRaw = receiptOcrResult.getPaidAtRaw();
        if (paidAtRaw != null && !paidAtRaw.isBlank()) {
            try {
                return Instant.parse(paidAtRaw.trim());
            } catch (DateTimeParseException ignored) {
                // Fallback to processed/requested timestamps when OCR paid_at is not ISO-8601.
            }
        }
        if (receiptOcrResult.getProcessedAt() != null) {
            return receiptOcrResult.getProcessedAt();
        }
        if (receiptOcrResult.getRequestedAt() != null) {
            return receiptOcrResult.getRequestedAt();
        }
        return Instant.now();
    }

    private void replaceSplits(UUID expenseId, BigDecimal totalAmount, List<UUID> participantUserIds, Instant now) {
        expenseSplitRepository.deleteByExpenseId(expenseId);
        List<ExpenseSplit> splits = buildEqualSplits(expenseId, totalAmount, participantUserIds, now);
        expenseSplitRepository.saveAll(splits);
    }

    private List<ExpenseSplit> buildEqualSplits(
            UUID expenseId,
            BigDecimal totalAmount,
            List<UUID> participantUserIds,
            Instant now
    ) {
        long totalMinorUnits = toMinorUnits(totalAmount);
        int participantCount = participantUserIds.size();
        long baseShare = totalMinorUnits / participantCount;
        long remainder = totalMinorUnits % participantCount;

        List<ExpenseSplit> splits = new ArrayList<>(participantCount);
        for (int i = 0; i < participantCount; i++) {
            long shareMinor = baseShare + (i < remainder ? 1 : 0);
            BigDecimal amount = BigDecimal.valueOf(shareMinor, 2);
            splits.add(ExpenseSplit.builder()
                    .expenseSplitId(UUID.randomUUID())
                    .expenseId(expenseId)
                    .userId(participantUserIds.get(i))
                    .amount(amount)
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
        }
        return splits;
    }

    private long toMinorUnits(BigDecimal amount) {
        try {
            return amount.movePointRight(2).longValueExact();
        } catch (ArithmeticException ex) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Amount is out of supported range.");
        }
    }
}
