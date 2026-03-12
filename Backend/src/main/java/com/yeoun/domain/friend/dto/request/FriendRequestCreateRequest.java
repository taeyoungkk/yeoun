package com.yeoun.domain.friend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FriendRequestCreateRequest(
        @Schema(description = "Target user ID", example = "11111111-1111-1111-1111-111111111111")
        @NotNull(message = "Friend user ID is required.")
        UUID friendUserId
) {
}
