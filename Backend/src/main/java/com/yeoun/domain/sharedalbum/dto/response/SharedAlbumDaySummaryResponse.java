package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SharedAlbumDaySummaryResponse(
        @Schema(description = "해당 일차의 날짜")
        LocalDate dayDate,
        @Schema(description = "여행 시작일부터 계산한 일차 번호")
        int dayNumber,
        @Schema(description = "화면 표시용 일차 라벨")
        String dayLabel,
        @Schema(description = "해당 일차의 총 이동 거리(m)")
        BigDecimal distanceM,
        @Schema(description = "해당 일차의 사진 수")
        int photoCount,
        @Schema(description = "해당 일차의 기록 수")
        int recordCount
) {
}
