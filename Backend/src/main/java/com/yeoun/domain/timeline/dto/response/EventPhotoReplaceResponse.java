package com.yeoun.domain.timeline.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record EventPhotoReplaceResponse(
        @Schema(description = "이벤트 ID")
        UUID eventId,
        @Schema(description = "연결된 사진 목록")
        List<EventPhotoResponse> photos,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {
}
