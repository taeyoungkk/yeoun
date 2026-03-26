package com.yeoun.domain.receipt.event;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReceiptOcrRequestEvent(
        UUID receiptId,
        UUID tripId,
        String imageUrl,
        String currencyCode,
        String locale,
        Instant requestedAt,
        int attempt
) {
}
