package com.yeoun.domain.trip.dto.request;

import com.yeoun.domain.trip.entity.TripVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TripUpdateRequest(
        @Schema(description = "여행명", example = "부산 2박3일 여행")
        @Size(max = 255, message = "Trip title must be 255 characters or fewer.")
        String title,

        @Schema(description = "여행 시작일", example = "2026-03-15")
        LocalDate startDate,

        @Schema(description = "여행 종료 예정일", example = "2026-03-18")
        LocalDate endDate,

        @Schema(description = "공개 범위", example = "PARTIAL_PUBLIC")
        TripVisibility visibility
) {
}
