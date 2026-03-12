package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record FriendListResponse(
        @Schema(description = "Friendship ID", example = "22222222-2222-2222-2222-222222222222")
        UUID friendshipId,
        @Schema(description = "Friend user ID", example = "11111111-1111-1111-1111-111111111111")
        UUID userId,
        @Schema(description = "Nickname", example = "alice")
        String nickname,
        @Schema(description = "Profile image URL", example = "https://cdn.example.com/profile/alice.png")
        String profileImageUrl
) {
}
