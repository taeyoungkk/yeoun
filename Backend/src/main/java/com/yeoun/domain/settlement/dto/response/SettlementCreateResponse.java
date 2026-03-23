package com.yeoun.domain.settlement.dto.response;

import com.yeoun.domain.settlement.entity.SettlementStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SettlementCreateResponse(
        UUID settlementId,
        UUID tripId,
        int versionNo,
        SettlementStatus status,
        String algorithmVersion,
        String note,
        String currencyCode,
        int memberCount,
        int confirmedExpenseCount,
        BigDecimal totalConfirmedAmount,
        int transferCount,
        UUID createdByUserId,
        Instant createdAt
) {
}
