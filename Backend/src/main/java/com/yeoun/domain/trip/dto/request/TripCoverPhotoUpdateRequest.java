package com.yeoun.domain.trip.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record TripCoverPhotoUpdateRequest(
        @Schema(description = "대표 사진으로 지정할 photoId. null이면 대표 사진을 해제합니다.")
        UUID photoId
) {
}
