package com.yeoun.domain.timeline.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

public record EventUpdateRequest(
        @Schema(description = "이벤트 제목", example = "점심 식사")
        @Size(max = 255, message = "Event title must be 255 characters or fewer.")
        String title,

        @Schema(description = "장소명", example = "광안리 해수욕장")
        @Size(max = 255, message = "Place name must be 255 characters or fewer.")
        String placeName,

        @Schema(description = "외부 장소 ID", example = "place_123")
        @Size(max = 255, message = "Place external id must be 255 characters or fewer.")
        String placeExternalId,

        @Schema(description = "시작 시각", example = "2026-10-02T05:30:00Z")
        Instant startAt,

        @Schema(description = "종료 시각", example = "2026-10-02T06:30:00Z")
        Instant endAt,

        @Schema(description = "중심 위도", example = "35.1532030")
        BigDecimal centerLatitude,

        @Schema(description = "중심 경도", example = "129.1186660")
        BigDecimal centerLongitude,

        @Schema(description = "반경(m)", example = "120")
        BigDecimal radiusM,

        @Schema(description = "숨김 여부", example = "false")
        Boolean hidden
) {
}
