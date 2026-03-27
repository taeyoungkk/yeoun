package com.yeoun.domain.settlement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseCategory;
import com.yeoun.domain.expense.entity.ExpenseSourceType;
import com.yeoun.domain.expense.entity.ExpenseSplitType;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.settlement.dto.response.SettlementCreateResponse;
import com.yeoun.domain.settlement.dto.response.SettlementDetailResponse;
import com.yeoun.domain.settlement.entity.Settlement;
import com.yeoun.domain.settlement.entity.SettlementStatus;
import com.yeoun.domain.settlement.repository.SettlementRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettlementLatestServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private SettlementRepository settlementRepository;

    @Mock
    private SettlementCommandService settlementCommandService;

    @Mock
    private SettlementQueryService settlementQueryService;

    @InjectMocks
    private SettlementLatestService settlementLatestService;

    @Test
    void getLatestSettlement_throwsWhenNoConfirmedExpensesExist() {
        UUID requesterUserId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();

        when(expenseRepository.findByTripIdAndStatusOrderByPaidAtDescCreatedAtDesc(tripId, ExpenseStatus.CONFIRMED))
                .thenReturn(List.of());

        assertThatThrownBy(() -> settlementLatestService.getLatestSettlement(requesterUserId, tripId))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.SETTLEMENT_LATEST_NOT_AVAILABLE);

        verify(settlementRepository, never()).findTopByTripIdOrderByVersionNoDesc(any());
        verify(settlementCommandService, never()).createSettlement(any(), any(), any());
    }

    @Test
    void getLatestSettlement_returnsExistingLatestWhenSnapshotMatchesCurrentExpenses() {
        UUID requesterUserId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        UUID expenseId = UUID.randomUUID();
        UUID settlementId = UUID.randomUUID();

        Expense expense = expense(tripId, expenseId, "12000.00");
        Settlement settlement = settlement(tripId, settlementId, List.of(expenseId), 1, "12000.00");
        SettlementDetailResponse expected = settlementDetail(settlementId, tripId);

        when(expenseRepository.findByTripIdAndStatusOrderByPaidAtDescCreatedAtDesc(tripId, ExpenseStatus.CONFIRMED))
                .thenReturn(List.of(expense));
        when(settlementRepository.findTopByTripIdOrderByVersionNoDesc(tripId))
                .thenReturn(Optional.of(settlement));
        when(settlementQueryService.getSettlementDetail(requesterUserId, settlementId))
                .thenReturn(expected);

        SettlementDetailResponse actual = settlementLatestService.getLatestSettlement(requesterUserId, tripId);

        assertThat(actual).isEqualTo(expected);
        verify(settlementCommandService, never()).createSettlement(any(), any(), any());
    }

    @Test
    void getLatestSettlement_createsSettlementWhenSnapshotDoesNotMatchCurrentExpenses() {
        UUID requesterUserId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        UUID currentExpenseId = UUID.randomUUID();
        UUID oldExpenseId = UUID.randomUUID();
        UUID oldSettlementId = UUID.randomUUID();
        UUID newSettlementId = UUID.randomUUID();

        Expense currentExpense = expense(tripId, currentExpenseId, "15000.00");
        Settlement outdatedSettlement = settlement(tripId, oldSettlementId, List.of(oldExpenseId), 1, "12000.00");
        SettlementCreateResponse created = new SettlementCreateResponse(
                newSettlementId,
                tripId,
                2,
                SettlementStatus.DRAFT,
                "v1-greedy-netting",
                null,
                "KRW",
                2,
                1,
                new BigDecimal("15000.00"),
                1,
                requesterUserId,
                Instant.parse("2026-03-27T00:00:00Z")
        );
        SettlementDetailResponse expected = settlementDetail(newSettlementId, tripId);

        when(expenseRepository.findByTripIdAndStatusOrderByPaidAtDescCreatedAtDesc(tripId, ExpenseStatus.CONFIRMED))
                .thenReturn(List.of(currentExpense));
        when(settlementRepository.findTopByTripIdOrderByVersionNoDesc(tripId))
                .thenReturn(Optional.of(outdatedSettlement), Optional.of(outdatedSettlement));
        when(settlementCommandService.createSettlement(eq(requesterUserId), eq(tripId), any()))
                .thenReturn(created);
        when(settlementQueryService.getSettlementDetail(requesterUserId, newSettlementId))
                .thenReturn(expected);

        SettlementDetailResponse actual = settlementLatestService.getLatestSettlement(requesterUserId, tripId);

        assertThat(actual).isEqualTo(expected);
        verify(settlementCommandService).createSettlement(eq(requesterUserId), eq(tripId), any());
    }

    private Expense expense(UUID tripId, UUID expenseId, String totalAmount) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        return Expense.builder()
                .expenseId(expenseId)
                .tripId(tripId)
                .createdByUserId(UUID.randomUUID())
                .payerUserId(UUID.randomUUID())
                .sourceType(ExpenseSourceType.MANUAL)
                .paymentImportId(null)
                .receiptId(null)
                .merchantName("merchant")
                .category(ExpenseCategory.FOOD)
                .currencyCode("KRW")
                .totalAmount(new BigDecimal(totalAmount))
                .paidAt(now)
                .memo(null)
                .splitType(ExpenseSplitType.EQUAL)
                .status(ExpenseStatus.CONFIRMED)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Settlement settlement(
            UUID tripId,
            UUID settlementId,
            List<UUID> confirmedExpenseIds,
            int confirmedExpenseCount,
            String totalConfirmedAmount
    ) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        ObjectNode snapshot = OBJECT_MAPPER.createObjectNode();
        snapshot.put("confirmedExpenseCount", confirmedExpenseCount);
        snapshot.put("totalConfirmedAmount", new BigDecimal(totalConfirmedAmount));
        var expenseIdsArray = snapshot.putArray("confirmedExpenseIds");
        confirmedExpenseIds.stream()
                .map(UUID::toString)
                .forEach(expenseIdsArray::add);

        return Settlement.builder()
                .settlementId(settlementId)
                .tripId(tripId)
                .versionNo(1)
                .status(SettlementStatus.DRAFT)
                .algorithmVersion("v1-greedy-netting")
                .note(null)
                .snapshotPayloadJson(snapshot)
                .createdByUserId(UUID.randomUUID())
                .finalizedAt(null)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private SettlementDetailResponse settlementDetail(UUID settlementId, UUID tripId) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        return new SettlementDetailResponse(
                settlementId,
                tripId,
                1,
                SettlementStatus.DRAFT,
                "v1-greedy-netting",
                null,
                "KRW",
                2,
                1,
                new BigDecimal("12000.00"),
                UUID.randomUUID(),
                null,
                now,
                now,
                new BigDecimal("12000.00"),
                1,
                List.of(),
                List.of()
        );
    }
}
