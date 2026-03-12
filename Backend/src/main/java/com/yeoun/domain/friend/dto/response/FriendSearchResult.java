package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record FriendSearchResult(
        @Schema(description = "Matched users")
        List<FriendSearchResponse> items
) {
}
