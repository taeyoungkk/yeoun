package com.yeoun.domain.expense.dto.response;

import java.util.List;

public record ExpenseListResponse(
        List<ExpenseListItemResponse> items
) {
}
