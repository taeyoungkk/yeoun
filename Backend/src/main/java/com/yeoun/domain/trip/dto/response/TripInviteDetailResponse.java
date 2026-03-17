package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripInviteStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripInviteDetailResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "여행명")
        String title,
        @Schema(description = "초대한 사용자")
        Inviter inviter,
        @Schema(description = "초대 상태")
        TripInviteStatus status,
        @Schema(description = "초대 만료 시각")
        Instant expiresAt
) {
    public record Inviter(
            @Schema(description = "초대한 사용자 ID")
            UUID userId,
            @Schema(description = "초대한 사용자 닉네임")
            String nickname
    ) {
    }
}
