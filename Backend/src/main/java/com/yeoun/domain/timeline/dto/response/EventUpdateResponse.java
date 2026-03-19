package com.yeoun.domain.timeline.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record EventUpdateResponse(
        @Schema(description = "이벤트 ID")
        UUID eventId,
        @Schema(description = "제목")
        String title,
        @Schema(description = "장소명")
        String placeName,
        @Schema(description = "외부 장소 ID")
        String placeExternalId,
        @Schema(description = "시작 시각")
        Instant startAt,
        @Schema(description = "종료 시각")
        Instant endAt,
        @Schema(description = "중심 위도")
        BigDecimal centerLatitude,
        @Schema(description = "중심 경도")
        BigDecimal centerLongitude,
        @Schema(description = "반경(m)")
        BigDecimal radiusM,
        @Schema(description = "숨김 여부")
        boolean hidden,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {
}
