package com.yeoun.domain.paymentimport.dto.response;

import com.yeoun.domain.paymentimport.entity.PaymentImportStatus;

import java.time.Instant;
import java.util.UUID;

public record PaymentImportIgnoreResponse(
        UUID paymentImportId,
        PaymentImportStatus status,
        Instant updatedAt
) {
}
