package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record TripDeleteResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "삭제 처리 여부")
        boolean deleted
) {
}
