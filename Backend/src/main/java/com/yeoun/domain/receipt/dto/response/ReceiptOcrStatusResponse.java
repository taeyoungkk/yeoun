package com.yeoun.domain.receipt.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record ReceiptOcrStatusResponse(
        @Schema(description = "영수증 ID")
        UUID receiptId,

        @Schema(description = "여행 ID")
        UUID tripId,

        @Schema(description = "OCR 상태")
        String status,

        @Schema(description = "처리 시도 횟수")
        int attempt,

        @Schema(description = "최근 요청 시각")
        Instant lastRequestedAt,

        @Schema(description = "최근 처리 시각")
        Instant lastProcessedAt,

        @Schema(description = "최근 오류 코드")
        String lastErrorCode,

        @Schema(description = "최근 오류 메시지")
        String lastErrorMessage,

        @Schema(description = "상태 갱신 시각")
        Instant updatedAt
) {
}
