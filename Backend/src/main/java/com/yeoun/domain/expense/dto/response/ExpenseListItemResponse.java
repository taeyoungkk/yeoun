package com.yeoun.domain.expense.dto.response;

import com.yeoun.domain.expense.entity.ExpenseCategory;
import com.yeoun.domain.expense.entity.ExpenseSourceType;
import com.yeoun.domain.expense.entity.ExpenseSplitType;
import com.yeoun.domain.expense.entity.ExpenseStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExpenseListItemResponse(
        UUID expenseId,
        UUID tripId,
        String merchantName,
        ExpenseCategory category,
        String currencyCode,
        BigDecimal totalAmount,
        Instant paidAt,
        UUID payerUserId,
        ExpenseSplitType splitType,
        ExpenseSourceType sourceType,
        ExpenseStatus status
) {
}
