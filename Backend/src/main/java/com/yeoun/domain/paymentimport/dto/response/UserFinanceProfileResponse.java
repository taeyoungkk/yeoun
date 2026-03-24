package com.yeoun.domain.paymentimport.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UserFinanceProfileResponse(
        UUID financeProfileId,
        UUID userId,
        String financeUserKey,
        String financeUserId,
        Instant syncedAt,
        List<UserFinanceAccountItemResponse> accounts,
        List<UserFinanceCardItemResponse> cards
) {
}
