package com.yeoun.domain.receipt.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

public record ReceiptOcrLineItemResponse(
        @Schema(description = "정렬 순서")
        int sortOrder,

        @Schema(description = "품목명")
        String name,

        @Schema(description = "수량")
        BigDecimal quantity,

        @Schema(description = "단가")
        BigDecimal unitPrice,

        @Schema(description = "금액")
        BigDecimal amount
) {
}
