package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record FriendListResult(
        @Schema(description = "친구 목록")
        List<FriendListResponse> items
) {
}
