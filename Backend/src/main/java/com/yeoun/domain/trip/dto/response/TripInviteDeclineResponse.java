package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record TripInviteDeclineResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "초대 상태")
        String status
) {
}
