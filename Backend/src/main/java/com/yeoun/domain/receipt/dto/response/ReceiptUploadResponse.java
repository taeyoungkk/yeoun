package com.yeoun.domain.receipt.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record ReceiptUploadResponse(
        @Schema(description = "영수증 ID")
        UUID receiptId,

        @Schema(description = "여행 ID")
        UUID tripId,

        @Schema(description = "저장소 키")
        String storageKey,

        @Schema(description = "Worker가 접근 가능한 영수증 이미지 URL")
        String imageUrl,

        @Schema(description = "업로드 시각")
        Instant uploadedAt
) {
}
