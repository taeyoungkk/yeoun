package com.yeoun.domain.locationlog.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record LocationLogBatchUploadResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "요청 사용자 ID")
        UUID userId,
        @Schema(description = "이번 요청에서 신규 반영 대상으로 분류된 건수")
        int storedCount,
        @Schema(description = "이번 요청에서 중복으로 분류된 건수")
        int duplicateCount,
        @Schema(description = "이번 요청에서 서버가 접수한 클라이언트 로그 UUID 목록")
        List<String> ackedClientLogUuids
) {
}
