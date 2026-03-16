package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripInviteType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripInviteLinkCreateResponse(
        @Schema(description = "여행 초대 ID")
        UUID tripInviteId,
        @Schema(description = "초대 방식")
        TripInviteType inviteType,
        @Schema(description = "초대 토큰")
        String inviteToken,
        @Schema(description = "초대 URL")
        String inviteUrl,
        @Schema(description = "만료 시각")
        Instant expiresAt
) {
}
