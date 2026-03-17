package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record TripMemberListResponse(
        @Schema(description = "여행 멤버 및 초대 현황 목록")
        List<TripMemberItemResponse> items
) {
}
