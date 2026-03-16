package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripStartResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "여행 상태")
        TripStatus status,
        @Schema(description = "여행 시작 시각")
        Instant startedAt
) {
}
