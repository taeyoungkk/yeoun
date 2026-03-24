package com.yeoun.domain.settlement.dto.response;

import com.yeoun.domain.settlement.entity.SettlementTransferStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SettlementTransferItemResponse(
        UUID settlementTransferId,
        UUID fromUserId,
        String fromNickname,
        UUID toUserId,
        String toNickname,
        BigDecimal amount,
        String currencyCode,
        SettlementTransferStatus status,
        Instant settledAt
) {
}
