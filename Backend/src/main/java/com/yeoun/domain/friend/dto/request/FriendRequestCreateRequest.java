package com.yeoun.domain.friend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FriendRequestCreateRequest(
        @Schema(description = "친구 요청을 보낼 대상 사용자 ID", example = "11111111-1111-1111-1111-111111111111")
        @NotNull(message = "Friend user ID is required.")
        UUID friendUserId
) {
}
