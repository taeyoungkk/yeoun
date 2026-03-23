package com.yeoun.domain.settlement.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record SettlementMemberItemResponse(
        UUID userId,
        String nickname,
        BigDecimal paidAmount,
        BigDecimal shareAmount,
        BigDecimal netAmount
) {
}
