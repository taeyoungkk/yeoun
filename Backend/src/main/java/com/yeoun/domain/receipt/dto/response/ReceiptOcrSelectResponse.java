package com.yeoun.domain.receipt.dto.response;

import com.yeoun.domain.expense.entity.ExpenseStatus;

import java.time.Instant;
import java.util.UUID;

public record ReceiptOcrSelectResponse(
        UUID receiptId,
        UUID tripId,
        UUID linkedExpenseId,
        ExpenseStatus expenseStatus,
        Instant createdAt
) {
}
