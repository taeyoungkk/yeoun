package com.yeoun.domain.tripsync.dto.response;

import com.yeoun.domain.tripsync.entity.SyncStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TripSyncStatusResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "여행 동기화 상태")
        SyncStatus syncStatus,
        @Schema(description = "경로 데이터 버전")
        long routeVersion,
        @Schema(description = "타임라인 데이터 버전")
        long timelineVersion,
        @Schema(description = "사진 데이터 버전")
        long photoVersion,
        @Schema(description = "마지막 갱신 시각")
        Instant updatedAt,
        @Schema(description = "마지막 에러 메시지")
        String lastErrorMessage
) {
}
