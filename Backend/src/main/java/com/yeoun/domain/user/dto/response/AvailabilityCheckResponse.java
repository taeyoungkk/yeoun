package com.yeoun.domain.user.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record AvailabilityCheckResponse(
        @Schema(description = "사용 가능 여부")
        boolean available
) {
}
