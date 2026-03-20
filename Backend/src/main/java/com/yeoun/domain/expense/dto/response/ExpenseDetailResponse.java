package com.yeoun.domain.expense.dto.response;

import com.yeoun.domain.expense.entity.ExpenseCategory;
import com.yeoun.domain.expense.entity.ExpenseSourceType;
import com.yeoun.domain.expense.entity.ExpenseSplitType;
import com.yeoun.domain.expense.entity.ExpenseStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExpenseDetailResponse(
        UUID expenseId,
        UUID tripId,
        UUID createdByUserId,
        String merchantName,
        ExpenseCategory category,
        String currencyCode,
        BigDecimal totalAmount,
        Instant paidAt,
        UUID payerUserId,
        String memo,
        ExpenseSplitType splitType,
        ExpenseSourceType sourceType,
        ExpenseStatus status,
        List<ExpenseSplitItemResponse> splits,
        Instant createdAt,
        Instant updatedAt
) {
}
