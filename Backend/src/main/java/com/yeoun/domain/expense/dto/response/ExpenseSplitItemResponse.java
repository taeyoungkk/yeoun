package com.yeoun.domain.expense.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record ExpenseSplitItemResponse(
        UUID userId,
        BigDecimal amount
) {
}
