package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record FriendRequestListItemResponse(
        @Schema(description = "친구 관계 ID", example = "22222222-2222-2222-2222-222222222222")
        UUID friendshipId,
        @Schema(description = "상대 사용자 ID", example = "11111111-1111-1111-1111-111111111111")
        UUID userId,
        @Schema(description = "상대 사용자 닉네임", example = "alice")
        String nickname,
        @Schema(description = "상대 사용자 프로필 이미지 URL", example = "https://cdn.example.com/profile/alice.png")
        String profileImageUrl,
        @Schema(description = "친구 요청 상태", example = "REQUESTED")
        String status
) {
}
