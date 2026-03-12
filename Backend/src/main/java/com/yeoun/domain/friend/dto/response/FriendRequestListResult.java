package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record FriendRequestListResult(
        @Schema(description = "친구 요청 목록")
        List<FriendRequestListItemResponse> items
) {
}
