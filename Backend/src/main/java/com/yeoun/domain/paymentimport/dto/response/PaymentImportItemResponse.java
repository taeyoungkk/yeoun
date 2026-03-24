package com.yeoun.domain.paymentimport.dto.response;

import com.yeoun.domain.paymentimport.entity.PaymentImportSourceType;
import com.yeoun.domain.paymentimport.entity.PaymentImportStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentImportItemResponse(
        UUID paymentImportId,
        UUID userId,
        UUID tripId,
        String merchantName,
        String transactionSummary,
        BigDecimal approvedAmount,
        String currencyCode,
        Instant approvedAt,
        String cardName,
        String accountNo,
        String approvalNo,
        String externalTransactionUniqueNo,
        PaymentImportSourceType sourceType,
        PaymentImportStatus status,
        UUID linkedExpenseId
) {
}
