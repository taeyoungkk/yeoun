package com.yeoun.domain.receipt.dto.request;

import com.yeoun.domain.expense.entity.ExpenseCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ReceiptOcrSelectRequest(
        @NotNull(message = "Payer user id is required.")
        UUID payerUserId,

        @NotNull(message = "Category is required.")
        ExpenseCategory category,

        @Size(max = 2000, message = "Memo must be 2000 characters or fewer.")
        String memo,

        @NotEmpty(message = "At least one line item is required.")
        List<@Valid @NotNull(message = "Line item cannot be null.") ReceiptOcrSelectLineItemRequest> lineItems
) {

    public record ReceiptOcrSelectLineItemRequest(
            @NotNull(message = "OCR line item id is required.")
            UUID ocrLineItemId,

            @NotNull(message = "Amount is required.")
            @Positive(message = "Amount must be positive.")
            BigDecimal amount,

            @NotEmpty(message = "At least one participant is required.")
            List<@NotNull(message = "Participant user id cannot be null.") UUID> participantUserIds
    ) {
    }
}
