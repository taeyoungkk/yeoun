package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record TripListResponse(
        @Schema(description = "여행 목록")
        List<TripListItemResponse> items
) {
}
