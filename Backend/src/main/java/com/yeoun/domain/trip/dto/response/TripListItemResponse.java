package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TripListItemResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "여행명")
        String title,
        @Schema(description = "여행 시작일")
        LocalDate startDate,
        @Schema(description = "여행 종료 예정일")
        LocalDate endDate,
        @Schema(description = "실제 여행 시작 시각")
        Instant startedAt,
        @Schema(description = "실제 여행 종료 시각")
        Instant actualEndedAt,
        @Schema(description = "여행 상태")
        TripStatus status,
        @Schema(description = "현재 참여 멤버 수")
        long memberCount
) {
}
