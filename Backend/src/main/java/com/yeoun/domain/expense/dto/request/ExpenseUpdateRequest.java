package com.yeoun.domain.expense.dto.request;

import com.yeoun.domain.expense.entity.ExpenseCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExpenseUpdateRequest(
        @Size(max = 255, message = "Merchant name must be 255 characters or fewer.")
        String merchantName,

        ExpenseCategory category,

        @Size(max = 10, message = "Currency code must be 10 characters or fewer.")
        String currencyCode,

        @DecimalMin(value = "0.01", message = "Total amount must be greater than 0.")
        BigDecimal totalAmount,

        Instant paidAt,

        UUID payerUserId,

        @Size(max = 2000, message = "Memo must be 2000 characters or fewer.")
        String memo,

        List<UUID> participantUserIds
) {
}
