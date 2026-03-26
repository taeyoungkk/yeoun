package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record SharedAlbumEventSelectionResponse(
        @Schema(description = "공유 앨범 ID")
        UUID sharedAlbumId,
        @Schema(description = "현재 선택된 이벤트 ID 목록")
        List<UUID> eventIds
) {
}
