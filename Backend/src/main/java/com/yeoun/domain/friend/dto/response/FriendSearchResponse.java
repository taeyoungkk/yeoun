package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record FriendSearchResponse(
        @Schema(description = "사용자 ID", example = "11111111-1111-1111-1111-111111111111")
        UUID userId,
        @Schema(description = "닉네임", example = "alice")
        String nickname,
        @Schema(description = "프로필 이미지 URL", example = "https://cdn.example.com/profile/alice.png")
        String profileImageUrl,
        @Schema(description = "현재 사용자 기준 친구 상태", example = "ACCEPTED")
        FriendRelationshipStatus friendStatus
) {
}
