package com.yeoun.domain.paymentimport.service;

import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseSplit;
import com.yeoun.domain.expense.entity.ExpenseSourceType;
import com.yeoun.domain.expense.entity.ExpenseSplitType;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.expense.repository.ExpenseSplitRepository;
import com.yeoun.domain.paymentimport.dto.request.PaymentImportSelectRequest;
import com.yeoun.domain.paymentimport.dto.response.PaymentImportIgnoreResponse;
import com.yeoun.domain.paymentimport.dto.response.PaymentImportSelectResponse;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class PaymentImportCommandService {

    private static final String SUPPORTED_CURRENCY_CODE = "KRW";

    private final PaymentImportRepository paymentImportRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public PaymentImportCommandService(
            PaymentImportRepository paymentImportRepository,
            ExpenseRepository expenseRepository,
            ExpenseSplitRepository expenseSplitRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.paymentImportRepository = paymentImportRepository;
        this.expenseRepository = expenseRepository;
        this.expenseSplitRepository = expenseSplitRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public PaymentImportSelectResponse selectPaymentImport(
            UUID requesterUserId,
            UUID paymentImportId,
            PaymentImportSelectRequest request
    ) {
        PaymentImport paymentImport = findOwnedPaymentImportOrThrow(requesterUserId, paymentImportId);
        if (paymentImport.getStatus() != PaymentImportStatus.CANDIDATE) {
            throw new BaseException(ErrorCode.PAYMENT_IMPORT_SELECTION_NOT_ALLOWED);
        }

        Trip trip = findNonDeletedTripOrThrow(request.tripId());
        validateTripAccessible(requesterUserId, trip);

        List<UUID> participantUserIds = normalizeParticipantUserIds(request.participantUserIds());
        validateUsersAreTripParticipants(trip.getTripId(), requesterUserId, request.payerUserId(), participantUserIds);
        BigDecimal totalAmount = validateAndNormalizeAmount(paymentImport.getApprovedAmount());
        String currencyCode = normalizeCurrencyCode(paymentImport.getCurrencyCode());

        Instant now = Instant.now();
        Expense expense = Expense.builder()
                .expenseId(UUID.randomUUID())
                .tripId(trip.getTripId())
                .createdByUserId(requesterUserId)
                .payerUserId(request.payerUserId())
                .sourceType(ExpenseSourceType.PAYMENT_IMPORT)
                .paymentImportId(paymentImport.getPaymentImportId())
                .receiptId(null)
                .merchantName(normalizeRequiredText(paymentImport.getMerchantName()))
                .category(request.category())
                .currencyCode(currencyCode)
                .totalAmount(totalAmount)
                .paidAt(paymentImport.getApprovedAt())
                .memo(normalizeOptionalText(request.memo()))
                .splitType(ExpenseSplitType.EQUAL)
                .status(ExpenseStatus.CONFIRMED)
                .createdAt(now)
                .updatedAt(now)
                .build();
        expenseRepository.save(expense);

        replaceSplits(expense.getExpenseId(), totalAmount, participantUserIds, now);
        paymentImport.markSelected(trip.getTripId(), expense.getExpenseId(), now);

        return new PaymentImportSelectResponse(
                paymentImport.getPaymentImportId(),
                paymentImport.getTripId(),
                paymentImport.getLinkedExpenseId(),
                paymentImport.getStatus(),
                paymentImport.getUpdatedAt()
        );
    }

    public PaymentImportIgnoreResponse ignorePaymentImport(UUID requesterUserId, UUID paymentImportId) {
        PaymentImport paymentImport = findOwnedPaymentImportOrThrow(requesterUserId, paymentImportId);
        if (paymentImport.getStatus() != PaymentImportStatus.CANDIDATE) {
            throw new BaseException(ErrorCode.PAYMENT_IMPORT_IGNORE_NOT_ALLOWED);
        }

        Instant now = Instant.now();
        paymentImport.markIgnored(now);

        return new PaymentImportIgnoreResponse(
                paymentImport.getPaymentImportId(),
                paymentImport.getStatus(),
                paymentImport.getUpdatedAt()
        );
    }

    private PaymentImport findOwnedPaymentImportOrThrow(UUID requesterUserId, UUID paymentImportId) {
        PaymentImport paymentImport = paymentImportRepository.findByPaymentImportId(paymentImportId)
                .orElseThrow(() -> new BaseException(ErrorCode.PAYMENT_IMPORT_NOT_FOUND));
        if (!paymentImport.getUserId().equals(requesterUserId)) {
            throw new BaseException(ErrorCode.PAYMENT_IMPORT_FORBIDDEN);
        }
        return paymentImport;
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

    private List<UUID> normalizeParticipantUserIds(List<UUID> participantUserIds) {
        if (participantUserIds == null || participantUserIds.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "At least one participant is required.");
        }
        LinkedHashSet<UUID> deduplicated = new LinkedHashSet<>();
        for (UUID userId : participantUserIds) {
            if (userId == null) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Participant user id cannot be null.");
            }
            deduplicated.add(userId);
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
