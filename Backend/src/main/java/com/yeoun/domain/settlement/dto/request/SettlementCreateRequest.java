package com.yeoun.domain.settlement.dto.request;

import jakarta.validation.constraints.Size;

public record SettlementCreateRequest(
        @Size(max = 2000, message = "Note must be 2000 characters or fewer.")
        String note
) {
}
