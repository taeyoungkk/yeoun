package com.yeoun.domain.trip.dto.response;

import com.yeoun.domain.trip.entity.TripReportStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TripDetailResponse(
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
        @Schema(description = "공개 범위")
        TripVisibility visibility,
        @Schema(description = "여행 생성자 ID")
        UUID ownerUserId,
        @Schema(description = "리포트 상태")
        TripReportStatus reportStatus,
        @Schema(description = "여행 대표 이미지 URL")
        String imageUrl,
        @Schema(description = "현재 참여 멤버 수")
        long memberCount,
        @Schema(description = "생성 일시")
        Instant createdAt
) {
}
