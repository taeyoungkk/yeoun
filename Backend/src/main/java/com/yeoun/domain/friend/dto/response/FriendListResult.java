package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record FriendListResult(
        @Schema(description = "Accepted friends")
        List<FriendListResponse> items
) {
}
