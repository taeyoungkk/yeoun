package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripInviteStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record ReceivedTripInviteItemResponse(
        @Schema(description = "여행 초대 ID")
        UUID tripInviteId,
        @Schema(description = "초대 토큰")
        String inviteToken,
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "여행 제목")
        String tripTitle,
        @Schema(description = "초대한 사용자")
        Inviter inviter,
        @Schema(description = "초대 상태")
        TripInviteStatus status,
        @Schema(description = "초대 만료 시각")
        Instant expiresAt,
        @Schema(description = "초대 생성 시각")
        Instant createdAt
) {
    public record Inviter(
            @Schema(description = "초대한 사용자 ID")
            UUID userId,
            @Schema(description = "초대한 사용자 닉네임")
            String nickname,
            @Schema(description = "초대한 사용자 프로필 이미지 URL")
            String profileImageUrl
    ) {
    }
}
