package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record FriendRequestCreateResponse(
        @Schema(description = "Friendship ID", example = "22222222-2222-2222-2222-222222222222")
        UUID friendshipId,
        @Schema(description = "Requested target user ID", example = "11111111-1111-1111-1111-111111111111")
        UUID friendUserId,
        @Schema(description = "Current friendship status", example = "REQUESTED")
        String status
) {
}
