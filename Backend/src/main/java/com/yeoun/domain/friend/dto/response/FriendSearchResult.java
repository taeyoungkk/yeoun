package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record FriendSearchResult(
        @Schema(description = "검색된 사용자 목록")
        List<FriendSearchResponse> items
) {
}
