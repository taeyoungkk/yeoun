package com.yeoun.domain.friend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record FriendRequestCreateResponse(
        @Schema(description = "친구 관계 ID", example = "22222222-2222-2222-2222-222222222222")
        UUID friendshipId,
        @Schema(description = "친구 요청을 받은 사용자 ID", example = "11111111-1111-1111-1111-111111111111")
        UUID friendUserId,
        @Schema(description = "현재 친구 요청 상태", example = "REQUESTED")
        String status
) {
}
