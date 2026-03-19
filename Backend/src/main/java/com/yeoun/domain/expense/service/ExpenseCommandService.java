package com.yeoun.domain.expense.service;

import com.yeoun.domain.expense.dto.request.ExpenseCreateRequest;
import com.yeoun.domain.expense.dto.request.ExpenseUpdateRequest;
import com.yeoun.domain.expense.dto.response.ExpenseCreateResponse;
import com.yeoun.domain.expense.dto.response.ExpenseDeleteResponse;
import com.yeoun.domain.expense.dto.response.ExpenseUpdateResponse;
import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseSplit;
import com.yeoun.domain.expense.entity.ExpenseSourceType;
import com.yeoun.domain.expense.entity.ExpenseSplitType;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.expense.repository.ExpenseSplitRepository;
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
public class ExpenseCommandService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public ExpenseCommandService(
            ExpenseRepository expenseRepository,
            ExpenseSplitRepository expenseSplitRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.expenseRepository = expenseRepository;
        this.expenseSplitRepository = expenseSplitRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public ExpenseCreateResponse createExpense(UUID requesterUserId, UUID tripId, ExpenseCreateRequest request) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);

        List<UUID> participantUserIds = normalizeParticipantUserIds(request.participantUserIds());
        UUID payerUserId = request.payerUserId();
        validateUsersAreTripParticipants(tripId, requesterUserId, payerUserId, participantUserIds);
        BigDecimal totalAmount = validateAndNormalizeAmount(request.totalAmount());

        Instant now = Instant.now();
        Expense expense = Expense.builder()
                .expenseId(UUID.randomUUID())
                .tripId(tripId)
                .createdByUserId(requesterUserId)
                .payerUserId(payerUserId)
                .sourceType(ExpenseSourceType.MANUAL)
                .paymentImportId(null)
                .merchantName(normalizeRequiredText(request.merchantName()))
                .category(request.category())
                .currencyCode(normalizeRequiredText(request.currencyCode()).toUpperCase())
                .totalAmount(totalAmount)
                .paidAt(request.paidAt())
                .memo(normalizeOptionalText(request.memo()))
                .splitType(ExpenseSplitType.EQUAL)
                .status(ExpenseStatus.CONFIRMED)
                .createdAt(now)
                .updatedAt(now)
                .build();
        expenseRepository.save(expense);

        replaceSplits(expense.getExpenseId(), totalAmount, participantUserIds, now);

        return new ExpenseCreateResponse(
                expense.getExpenseId(),
                expense.getTripId(),
                expense.getMerchantName(),
                expense.getCategory(),
                expense.getCurrencyCode(),
                expense.getTotalAmount(),
                expense.getPaidAt(),
                expense.getPayerUserId(),
                expense.getMemo(),
                participantUserIds,
                expense.getSplitType(),
                expense.getSourceType(),
                expense.getStatus(),
                expense.getCreatedAt()
        );
    }

    public ExpenseUpdateResponse updateExpense(UUID requesterUserId, UUID expenseId, ExpenseUpdateRequest request) {
        Expense expense = expenseRepository.findByExpenseIdAndStatusNot(expenseId, ExpenseStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.EXPENSE_NOT_FOUND));

        Trip trip = findNonDeletedTripOrThrow(expense.getTripId());
        validateTripAccessible(requesterUserId, trip);

        String merchantName = request.merchantName() == null
                ? expense.getMerchantName()
                : normalizeRequiredText(request.merchantName());
        String currencyCode = request.currencyCode() == null
                ? expense.getCurrencyCode()
                : normalizeRequiredText(request.currencyCode()).toUpperCase();
        BigDecimal totalAmount = request.totalAmount() == null
                ? expense.getTotalAmount()
                : validateAndNormalizeAmount(request.totalAmount());
        UUID payerUserId = request.payerUserId() == null
                ? expense.getPayerUserId()
                : request.payerUserId();

        List<UUID> participantUserIds;
        boolean participantChanged = request.participantUserIds() != null;
        if (participantChanged) {
            participantUserIds = normalizeParticipantUserIds(request.participantUserIds());
        } else {
            participantUserIds = expenseSplitRepository.findByExpenseIdOrderByCreatedAtAsc(expenseId)
                    .stream()
                    .map(ExpenseSplit::getUserId)
                    .toList();
        }

        validateUsersAreTripParticipants(expense.getTripId(), requesterUserId, payerUserId, participantUserIds);

        Instant now = Instant.now();
        expense.update(
                merchantName,
                request.category() == null ? expense.getCategory() : request.category(),
                currencyCode,
                totalAmount,
                request.paidAt() == null ? expense.getPaidAt() : request.paidAt(),
                payerUserId,
                request.memo() == null ? expense.getMemo() : normalizeOptionalText(request.memo()),
                now
        );

        if (participantChanged || request.totalAmount() != null) {
            replaceSplits(expense.getExpenseId(), totalAmount, participantUserIds, now);
        }

        return new ExpenseUpdateResponse(
                expense.getExpenseId(),
                expense.getTripId(),
                expense.getCategory(),
                expense.getMemo(),
                expense.getUpdatedAt()
        );
    }

    public ExpenseDeleteResponse deleteExpense(UUID requesterUserId, UUID expenseId) {
        Expense expense = expenseRepository.findByExpenseIdAndStatusNot(expenseId, ExpenseStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.EXPENSE_NOT_FOUND));

        Trip trip = findNonDeletedTripOrThrow(expense.getTripId());
        validateTripAccessible(requesterUserId, trip);

        Instant now = Instant.now();
        expense.markDeleted(now);

        return new ExpenseDeleteResponse(expense.getExpenseId(), expense.getStatus(), expense.getUpdatedAt());
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

        if (!currentParticipantIds.contains(requesterUserId)
                || !currentParticipantIds.contains(payerUserId)
                || !currentParticipantIds.containsAll(participantUserIds)) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
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
        if (deduplicated.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "At least one participant is required.");
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
        if (participantUserIds.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "At least one participant is required.");
        }

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
