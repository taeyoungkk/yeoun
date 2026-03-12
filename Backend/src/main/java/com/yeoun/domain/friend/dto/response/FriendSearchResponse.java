package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record FriendSearchResponse(
        @Schema(description = "User ID", example = "11111111-1111-1111-1111-111111111111")
        UUID userId,
        @Schema(description = "Nickname", example = "alice")
        String nickname,
        @Schema(description = "Profile image URL", example = "https://cdn.example.com/profile/alice.png")
        String profileImageUrl,
        @Schema(description = "Relationship status from current user perspective", example = "ACCEPTED")
        FriendRelationshipStatus friendStatus
) {
}
