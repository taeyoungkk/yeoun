package com.yeoun.domain.paymentimport.dto.response;

import java.util.UUID;

public record UserFinanceAccountItemResponse(
        UUID financeAccountId,
        String accountNo,
        String accountName,
        boolean active
) {
}
