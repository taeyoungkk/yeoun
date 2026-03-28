package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripCoverPhotoUpdateResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "대표 사진 ID")
        UUID coverPhotoId,
        @Schema(description = "대표 이미지 URL")
        String imageUrl,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {
}
