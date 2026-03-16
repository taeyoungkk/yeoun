package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripVisibility;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TripUpdateResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "여행명")
        String title,
        @Schema(description = "여행 시작일")
        LocalDate startDate,
        @Schema(description = "여행 종료 예정일")
        LocalDate endDate,
        @Schema(description = "공개 범위")
        TripVisibility visibility,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {
}
