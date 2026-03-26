package com.yeoun.domain.expense.service;

import com.yeoun.domain.expense.dto.response.ExpenseDetailResponse;
import com.yeoun.domain.expense.dto.response.ExpenseListItemResponse;
import com.yeoun.domain.expense.dto.response.ExpenseListResponse;
import com.yeoun.domain.expense.dto.response.ExpenseSplitItemResponse;
import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseSplit;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ExpenseQueryService {

    private static final Logger log = LoggerFactory.getLogger(ExpenseQueryService.class);

    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public ExpenseQueryService(
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

    public ExpenseListResponse getTripExpenses(UUID requesterUserId, UUID tripId) {
        log.info("Trip expense list lookup started. requesterUserId={} tripId={}", requesterUserId, tripId);
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);

        List<Expense> expenses = expenseRepository
                .findByTripIdAndStatusNotOrderByPaidAtDescCreatedAtDesc(tripId, ExpenseStatus.DELETED);
        Map<UUID, List<ExpenseSplitItemResponse>> splitsByExpenseId = loadSplitsByExpenseId(expenses);

        List<ExpenseListItemResponse> items = expenses.stream()
                .map(expense -> new ExpenseListItemResponse(
                        expense.getExpenseId(),
                        expense.getTripId(),
                        expense.getMerchantName(),
                        expense.getCategory(),
                        expense.getCurrencyCode(),
                        expense.getTotalAmount(),
                        expense.getPaidAt(),
                        expense.getPayerUserId(),
                        expense.getSplitType(),
                        expense.getSourceType(),
                        expense.getStatus(),
                        splitsByExpenseId.getOrDefault(expense.getExpenseId(), List.of())
                ))
                .toList();

        log.info("Trip expense list lookup completed. requesterUserId={} tripId={} expenseCount={}", requesterUserId, tripId, items.size());
        return new ExpenseListResponse(items);
    }

    public ExpenseDetailResponse getExpenseDetail(UUID requesterUserId, UUID expenseId) {
        log.info("Expense detail lookup started. requesterUserId={} expenseId={}", requesterUserId, expenseId);
        Expense expense = expenseRepository.findByExpenseIdAndStatusNot(expenseId, ExpenseStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.EXPENSE_NOT_FOUND));

        Trip trip = findNonDeletedTripOrThrow(expense.getTripId());
        validateTripAccessible(requesterUserId, trip);

        List<ExpenseSplitItemResponse> splitItems = expenseSplitRepository.findByExpenseIdOrderByCreatedAtAsc(expenseId)
                .stream()
                .map(this::toSplitItem)
                .toList();

        ExpenseDetailResponse response = new ExpenseDetailResponse(
                expense.getExpenseId(),
                expense.getTripId(),
                expense.getCreatedByUserId(),
                expense.getMerchantName(),
                expense.getCategory(),
                expense.getCurrencyCode(),
                expense.getTotalAmount(),
                expense.getPaidAt(),
                expense.getPayerUserId(),
                expense.getMemo(),
                expense.getSplitType(),
                expense.getSourceType(),
                expense.getStatus(),
                splitItems,
                expense.getCreatedAt(),
                expense.getUpdatedAt()
        );
        log.info("Expense detail lookup completed. requesterUserId={} expenseId={} splitCount={}", requesterUserId, expenseId, splitItems.size());
        return response;
    }

    private Map<UUID, List<ExpenseSplitItemResponse>> loadSplitsByExpenseId(List<Expense> expenses) {
        List<UUID> expenseIds = expenses.stream()
                .map(Expense::getExpenseId)
                .toList();
        if (expenseIds.isEmpty()) {
            return Collections.emptyMap();
        }

        return expenseSplitRepository.findByExpenseIdIn(expenseIds).stream()
                .collect(Collectors.groupingBy(
                        ExpenseSplit::getExpenseId,
                        Collectors.mapping(this::toSplitItem, Collectors.toList())
                ));
    }

    private ExpenseSplitItemResponse toSplitItem(ExpenseSplit split) {
        return new ExpenseSplitItemResponse(split.getUserId(), split.getAmount());
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
