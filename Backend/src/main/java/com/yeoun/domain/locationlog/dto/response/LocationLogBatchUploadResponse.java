package com.yeoun.domain.locationlog.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record LocationLogBatchUploadResponse(
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "업로드 사용자 ID")
        UUID userId,
        @Schema(description = "신규 저장 건수")
        int storedCount,
        @Schema(description = "중복으로 간주된 건수")
        int duplicateCount,
        @Schema(description = "서버 반영이 확인된 클라이언트 로그 UUID 목록")
        List<String> ackedClientLogUuids
) {
}
