package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TripCreateResponse(
        @Schema(description = "여행 ID")
        UUID tripId,

        @Schema(description = "여행명")
        String title,

        @Schema(description = "여행 시작일")
        LocalDate startDate,

        @Schema(description = "여행 종료 예정일")
        LocalDate endDate,

        @Schema(description = "여행 상태")
        TripStatus status,

        @Schema(description = "공개 범위")
        TripVisibility visibility,

        @Schema(description = "생성 시각")
        Instant createdAt
) {
}
