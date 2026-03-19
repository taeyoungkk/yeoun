package com.yeoun.domain.timeline.dto.response;

import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TimelineBuildJobResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "처리 상태")
        TripProcessingStatusType status,
        @Schema(description = "생성된 일자 수")
        int timelineDayCount,
        @Schema(description = "생성된 이벤트 수")
        int eventCount,
        @Schema(description = "요청 시각")
        Instant requestedAt,
        @Schema(description = "완료 시각")
        Instant processedAt
) {
}
