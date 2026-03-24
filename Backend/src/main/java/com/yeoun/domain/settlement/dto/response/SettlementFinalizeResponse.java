package com.yeoun.domain.settlement.dto.response;

import com.yeoun.domain.settlement.entity.SettlementStatus;

import java.time.Instant;
import java.util.UUID;

public record SettlementFinalizeResponse(
        UUID settlementId,
        UUID tripId,
        int versionNo,
        SettlementStatus status,
        Instant finalizedAt,
        Instant updatedAt
) {
}
