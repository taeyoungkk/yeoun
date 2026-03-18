package com.yeoun.domain.photo.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record PhotoUpdateResponse(
        @Schema(description = "사진 ID")
        UUID photoId,
        @Schema(description = "제외 여부")
        boolean isExcluded,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {
}
