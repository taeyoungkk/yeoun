package com.yeoun.domain.expense.dto.response;

import com.yeoun.domain.expense.entity.ExpenseStatus;

import java.time.Instant;
import java.util.UUID;

public record ExpenseDeleteResponse(
        UUID expenseId,
        ExpenseStatus status,
        Instant updatedAt
) {
}
