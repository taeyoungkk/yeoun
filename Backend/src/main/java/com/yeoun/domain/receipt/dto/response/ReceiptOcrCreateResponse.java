package com.yeoun.domain.receipt.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record ReceiptOcrCreateResponse(
        @Schema(description = "영수증 ID")
        UUID receiptId,

        @Schema(description = "여행 ID")
        UUID tripId,

        @Schema(description = "OCR 요청 상태")
        String status,

        @Schema(description = "요청 시각")
        Instant requestedAt
) {
}
