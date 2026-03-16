package com.yeoun.domain.trip.dto.request;

import com.yeoun.domain.trip.entity.TripVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TripCreateRequest(
        @Schema(description = "여행명", example = "제주 가을 여행")
        @NotBlank(message = "Trip title is required.")
        @Size(max = 255, message = "Trip title must be 255 characters or fewer.")
        String title,

        @Schema(description = "여행 시작일", example = "2026-10-01")
        @NotNull(message = "Trip start date is required.")
        LocalDate startDate,

        @Schema(description = "여행 종료 예정일", example = "2026-10-05")
        @NotNull(message = "Trip end date is required.")
        LocalDate endDate,

        @Schema(description = "공개 범위", example = "PRIVATE")
        TripVisibility visibility
) {
}
