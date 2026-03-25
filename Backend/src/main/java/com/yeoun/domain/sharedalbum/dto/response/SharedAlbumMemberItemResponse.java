package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record SharedAlbumMemberItemResponse(
        @Schema(description = "사용자 ID")
        UUID userId,
        @Schema(description = "닉네임")
        String nickname,
        @Schema(description = "프로필 이미지 URL")
        String profileImageUrl
) {
}
