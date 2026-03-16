package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripMemberItemResponse(
        @Schema(description = "여행 참여자 ID")
        UUID tripMemberId,
        @Schema(description = "사용자 ID")
        UUID userId,
        @Schema(description = "닉네임")
        String nickname,
        @Schema(description = "프로필 이미지 URL")
        String profileImageUrl,
        @Schema(description = "초대 상태")
        TripMemberInviteStatus inviteStatus,
        @Schema(description = "참여 시각")
        Instant joinedAt
) {
}
