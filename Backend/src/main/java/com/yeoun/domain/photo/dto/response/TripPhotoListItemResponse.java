package com.yeoun.domain.photo.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripPhotoListItemResponse(
        @Schema(description = "사진 ID")
        UUID photoId,
        @Schema(description = "썸네일 key")
        String thumbnailUrl,
        @Schema(description = "촬영 시각")
        Instant takenAt,
        @Schema(description = "제외 여부")
        boolean isExcluded
) {
}
