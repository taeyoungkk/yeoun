package com.yeoun.domain.receipt.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.UUID;

public record ReceiptOcrLineItemResponse(
        @Schema(description = "OCR line item id")
        UUID ocrLineItemId,

        @Schema(description = "Line item sort order")
        int sortOrder,

        @Schema(description = "Line item name")
        String name,

        @Schema(description = "Quantity")
        BigDecimal quantity,

        @Schema(description = "Unit price")
        BigDecimal unitPrice,

        @Schema(description = "Amount")
        BigDecimal amount
) {
}
