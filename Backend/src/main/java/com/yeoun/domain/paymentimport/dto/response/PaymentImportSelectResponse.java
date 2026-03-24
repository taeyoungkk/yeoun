package com.yeoun.domain.paymentimport.dto.response;

import com.yeoun.domain.paymentimport.entity.PaymentImportStatus;

import java.time.Instant;
import java.util.UUID;

public record PaymentImportSelectResponse(
        UUID paymentImportId,
        UUID tripId,
        UUID linkedExpenseId,
        PaymentImportStatus status,
        Instant updatedAt
) {
}
