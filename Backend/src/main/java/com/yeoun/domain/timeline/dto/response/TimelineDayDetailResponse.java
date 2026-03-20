package com.yeoun.domain.timeline.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record TimelineDayDetailResponse(
        @Schema(description = "일자 타임라인 ID")
        UUID timelineDayId,
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "기준 날짜")
        LocalDate dayDate,
        @Schema(description = "일자 요약")
        String summaryText,
        @Schema(description = "이동 거리(m)")
        BigDecimal distanceM,
        @Schema(description = "사진 수")
        int photoCount,
        @Schema(description = "이벤트 수")
        int eventCount,
        @Schema(description = "생성 시각")
        Instant createdAt,
        @Schema(description = "수정 시각")
        Instant updatedAt,
        @Schema(description = "이벤트 목록")
        List<TimelineEventSummaryResponse> events
) {
}
