package com.yeoun.domain.settlement.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.settlement.dto.request.SettlementCreateRequest;
import com.yeoun.domain.settlement.dto.response.SettlementCreateResponse;
import com.yeoun.domain.settlement.dto.response.SettlementDetailResponse;
import com.yeoun.domain.settlement.entity.Settlement;
import com.yeoun.domain.settlement.repository.SettlementRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SettlementLatestService {

    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final SettlementCommandService settlementCommandService;
    private final SettlementQueryService settlementQueryService;

    public SettlementLatestService(
            ExpenseRepository expenseRepository,
            SettlementRepository settlementRepository,
            SettlementCommandService settlementCommandService,
            SettlementQueryService settlementQueryService
    ) {
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.settlementCommandService = settlementCommandService;
        this.settlementQueryService = settlementQueryService;
    }

    public SettlementDetailResponse getLatestSettlement(UUID requesterUserId, UUID tripId) {
        CurrentSettlementState currentState = calculateCurrentState(tripId);

        Settlement latestSettlement = settlementRepository.findTopByTripIdOrderByVersionNoDesc(tripId)
                .orElse(null);
        if (matchesCurrentState(latestSettlement, currentState)) {
            return settlementQueryService.getSettlementDetail(requesterUserId, latestSettlement.getSettlementId());
        }

        Settlement refreshedLatestSettlement = settlementRepository.findTopByTripIdOrderByVersionNoDesc(tripId)
                .orElse(null);
        if (matchesCurrentState(refreshedLatestSettlement, currentState)) {
            return settlementQueryService.getSettlementDetail(requesterUserId, refreshedLatestSettlement.getSettlementId());
        }

        SettlementCreateResponse created = settlementCommandService.createSettlement(
                requesterUserId,
                tripId,
                new SettlementCreateRequest(null)
        );
        return settlementQueryService.getSettlementDetail(requesterUserId, created.settlementId());
    }

    private CurrentSettlementState calculateCurrentState(UUID tripId) {
        List<Expense> expenses = expenseRepository.findByTripIdAndStatusOrderByPaidAtDescCreatedAtDesc(
                tripId,
                ExpenseStatus.CONFIRMED
        );
        if (expenses.isEmpty()) {
            throw new BaseException(ErrorCode.SETTLEMENT_LATEST_NOT_AVAILABLE);
        }
        List<UUID> confirmedExpenseIds = expenses.stream()
                .map(Expense::getExpenseId)
                .sorted()
                .toList();
        BigDecimal totalConfirmedAmount = expenses.stream()
                .map(Expense::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        return new CurrentSettlementState(
                confirmedExpenseIds,
                confirmedExpenseIds.size(),
                totalConfirmedAmount
        );
    }

    private boolean matchesCurrentState(Settlement settlement, CurrentSettlementState currentState) {
        if (settlement == null) {
            return false;
        }

        JsonNode snapshot = settlement.getSnapshotPayloadJson();
        JsonNode expenseIdsNode = snapshot.path("confirmedExpenseIds");
        if (!expenseIdsNode.isArray()) {
            return false;
        }

        List<UUID> snapshotExpenseIds = java.util.stream.StreamSupport.stream(expenseIdsNode.spliterator(), false)
                .map(JsonNode::asText)
                .filter(value -> !value.isBlank())
                .map(UUID::fromString)
                .sorted()
                .toList();
        int snapshotExpenseCount = snapshot.path("confirmedExpenseCount").asInt(-1);
        BigDecimal snapshotTotalConfirmedAmount = snapshot.path("totalConfirmedAmount").isNumber()
                ? snapshot.path("totalConfirmedAmount").decimalValue().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        return snapshotExpenseIds.equals(currentState.confirmedExpenseIds())
                && snapshotExpenseCount == currentState.confirmedExpenseCount()
                && snapshotTotalConfirmedAmount.compareTo(currentState.totalConfirmedAmount()) == 0;
    }

    private record CurrentSettlementState(
            List<UUID> confirmedExpenseIds,
            int confirmedExpenseCount,
            BigDecimal totalConfirmedAmount
    ) {
    }
}
