package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

public record SharedAlbumTripSummaryResponse(
        @Schema(description = "여행 전체 총 이동 거리(m)")
        BigDecimal totalDistanceM,
        @Schema(description = "여행 전체 사진 수")
        int photoCount,
        @Schema(description = "여행 전체 기록 수")
        int recordCount,
        @Schema(description = "현재 여행자 수")
        long travelerCount,
        @Schema(description = "여행 기간 기준 총 일수")
        int tripDayCount,
        @Schema(description = "확정된 총 사용 금액")
        BigDecimal totalCost,
        @Schema(description = "여행자 수 기준 1인당 평균 금액")
        BigDecimal costPerTraveler
) {
}
