package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record SharedAlbumSectionAvailabilityResponse(
        @Schema(description = "타임라인 상세 섹션을 열 수 있는지 여부")
        boolean timelineAvailable,
        @Schema(description = "이동 경로 섹션을 표시할 수 있는지 여부")
        boolean routeAvailable,
        @Schema(description = "정산 또는 지출 섹션을 표시할 수 있는지 여부")
        boolean settlementAvailable
) {
}
