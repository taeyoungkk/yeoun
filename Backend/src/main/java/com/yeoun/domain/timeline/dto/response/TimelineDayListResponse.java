package com.yeoun.domain.timeline.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record TimelineDayListResponse(
        @Schema(description = "여행 일자 목록")
        List<TimelineDayListItemResponse> timelineDays
) {
}
