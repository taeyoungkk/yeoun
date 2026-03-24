package com.yeoun.domain.paymentimport.dto.request;

import com.yeoun.domain.expense.entity.ExpenseCategory;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record PaymentImportSelectRequest(
        @NotNull(message = "Trip id is required.")
        UUID tripId,

        @NotNull(message = "Payer user id is required.")
        UUID payerUserId,

        @NotNull(message = "Category is required.")
        ExpenseCategory category,

        @Size(max = 2000, message = "Memo must be 2000 characters or fewer.")
        String memo,

        @NotEmpty(message = "At least one participant is required.")
        List<@NotNull(message = "Participant user id cannot be null.") UUID> participantUserIds
) {
}
