package com.yeoun.domain.locationlog.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record LocationLogBatchUploadResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "요청 사용자 ID")
        UUID userId,
        @Schema(description = "이번 요청에서 Kafka 적재 대상으로 접수한 건수")
        int acceptedCount,
        @Schema(description = "중복 제거 후 서버가 접수한 클라이언트 로그 UUID 목록")
        List<String> acceptedClientLogUuids,
        @Schema(description = "수집 요청 접수 시각")
        Instant acceptedAt
) {
}
