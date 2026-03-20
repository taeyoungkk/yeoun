package com.yeoun.domain.expense.dto.response;

import com.yeoun.domain.expense.entity.ExpenseCategory;

import java.time.Instant;
import java.util.UUID;

public record ExpenseUpdateResponse(
        UUID expenseId,
        UUID tripId,
        ExpenseCategory category,
        String memo,
        Instant updatedAt
) {
}
