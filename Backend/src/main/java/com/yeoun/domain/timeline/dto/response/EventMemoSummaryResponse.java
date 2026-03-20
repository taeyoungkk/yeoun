package com.yeoun.domain.timeline.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record EventMemoSummaryResponse(
        @Schema(description = "이벤트 메모 ID")
        UUID eventMemoId,
        @Schema(description = "이벤트 ID")
        UUID eventId,
        @Schema(description = "작성 사용자 ID")
        UUID userId,
        @Schema(description = "메모 내용")
        String content,
        @Schema(description = "생성 시각")
        Instant createdAt,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {
}
