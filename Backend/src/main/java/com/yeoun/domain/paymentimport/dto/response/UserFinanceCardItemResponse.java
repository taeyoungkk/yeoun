package com.yeoun.domain.paymentimport.dto.response;

import java.util.UUID;

public record UserFinanceCardItemResponse(
        UUID financeCardId,
        String cardNoMasked,
        String cardName,
        String cardUniqueNo,
        boolean cvcRegistered,
        boolean active
) {
}
