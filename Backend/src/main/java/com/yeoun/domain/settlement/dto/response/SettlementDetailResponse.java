package com.yeoun.domain.settlement.dto.response;

import com.yeoun.domain.settlement.entity.SettlementStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SettlementDetailResponse(
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
        UUID createdByUserId,
        Instant finalizedAt,
        Instant createdAt,
        Instant updatedAt,
        BigDecimal totalTransferAmount,
        int transferCount,
        List<SettlementMemberItemResponse> memberSettlements,
        List<SettlementTransferItemResponse> transfers
) {
}
