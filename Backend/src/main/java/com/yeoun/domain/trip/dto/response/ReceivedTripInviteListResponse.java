package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record ReceivedTripInviteListResponse(
        @Schema(description = "내가 받은 여행 초대 목록")
        List<ReceivedTripInviteItemResponse> items
) {
}
