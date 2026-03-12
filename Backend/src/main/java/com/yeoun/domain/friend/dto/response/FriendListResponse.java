package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record FriendListResponse(
        @Schema(description = "친구 관계 ID", example = "22222222-2222-2222-2222-222222222222")
        UUID friendshipId,
        @Schema(description = "친구 사용자 ID", example = "11111111-1111-1111-1111-111111111111")
        UUID userId,
        @Schema(description = "닉네임", example = "alice")
        String nickname,
        @Schema(description = "프로필 이미지 URL", example = "https://cdn.example.com/profile/alice.png")
        String profileImageUrl
) {
}
