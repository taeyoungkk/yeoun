package com.yeoun.domain.settlement.dto.response;

import java.util.List;

public record SettlementListResponse(
        List<SettlementListItemResponse> items
) {
}
