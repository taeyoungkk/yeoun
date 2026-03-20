package com.yeoun.domain.expense.dto.request;

import com.yeoun.domain.expense.entity.ExpenseCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExpenseCreateRequest(
        @NotBlank(message = "Merchant name is required.")
        @Size(max = 255, message = "Merchant name must be 255 characters or fewer.")
        String merchantName,

        @NotNull(message = "Category is required.")
        ExpenseCategory category,

        @NotBlank(message = "Currency code is required.")
        @Size(max = 10, message = "Currency code must be 10 characters or fewer.")
        String currencyCode,

        @NotNull(message = "Total amount is required.")
        @DecimalMin(value = "0.01", message = "Total amount must be greater than 0.")
        BigDecimal totalAmount,

        @NotNull(message = "Paid at is required.")
        Instant paidAt,

        @NotNull(message = "Payer user id is required.")
        UUID payerUserId,

        @Size(max = 2000, message = "Memo must be 2000 characters or fewer.")
        String memo,

        @NotEmpty(message = "At least one participant is required.")
        List<@NotNull(message = "Participant user id cannot be null.") UUID> participantUserIds
) {
}
