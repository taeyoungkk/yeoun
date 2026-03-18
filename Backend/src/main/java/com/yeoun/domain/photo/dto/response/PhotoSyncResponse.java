package com.yeoun.domain.photo.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record PhotoSyncResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "동기화된 사진 개수")
        int syncedCount,
        @Schema(description = "동기화된 사진 목록")
        List<PhotoSyncItemResponse> items
) {
}
