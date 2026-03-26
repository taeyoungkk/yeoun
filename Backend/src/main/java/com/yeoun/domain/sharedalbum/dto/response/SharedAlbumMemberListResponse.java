package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record SharedAlbumMemberListResponse(
        @Schema(description = "공유 앨범 ID")
        UUID sharedAlbumId,
        @Schema(description = "공유 앨범에 접근 가능한 멤버 목록")
        List<SharedAlbumMemberItemResponse> members
) {
}
