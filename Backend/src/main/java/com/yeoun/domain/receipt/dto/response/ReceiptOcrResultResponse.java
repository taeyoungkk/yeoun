package com.yeoun.domain.receipt.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ReceiptOcrResultResponse(
        @Schema(description = "영수증 ID")
        UUID receiptId,

        @Schema(description = "여행 ID")
        UUID tripId,

        @Schema(description = "이미지 URL")
        String imageUrl,

        @Schema(description = "OCR 결과 상태")
        String status,

        @Schema(description = "가맹점명")
        String merchantName,

        @Schema(description = "결제 시각 원문")
        String paidAt,

        @Schema(description = "통화 코드")
        String currencyCode,

        @Schema(description = "총 결제 금액")
        BigDecimal totalAmount,

        @Schema(description = "세금")
        BigDecimal taxAmount,

        @Schema(description = "품목 목록")
        List<ReceiptOcrLineItemResponse> lineItems,

        @Schema(description = "원문 OCR 텍스트")
        String rawText,

        @Schema(description = "오류 코드")
        String errorCode,

        @Schema(description = "오류 메시지")
        String errorMessage,

        @Schema(description = "처리 시도 횟수")
        int attempt,

        @Schema(description = "요청 시각")
        Instant requestedAt,

        @Schema(description = "처리 완료 시각")
        Instant processedAt
) {
}
