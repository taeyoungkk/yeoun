package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripLeaveResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "여행 이탈 처리 여부")
        boolean left,
        @Schema(description = "이탈 시각")
        Instant leftAt
) {
}
