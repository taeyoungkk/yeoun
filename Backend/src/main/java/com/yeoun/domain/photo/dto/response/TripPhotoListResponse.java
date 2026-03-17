package com.yeoun.domain.photo.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record TripPhotoListResponse(
        @Schema(description = "사진 목록")
        List<TripPhotoListItemResponse> items
) {
}
