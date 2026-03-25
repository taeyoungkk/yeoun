package com.yeoun.domain.timeline.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record EventPhotoResponse(
        @Schema(description = "이벤트 사진 연결 ID")
        UUID eventPhotoId,
        @Schema(description = "사진 ID")
        UUID photoId,
        @Schema(description = "원본 사진 URL")
        String originalUrl,
        @Schema(description = "썸네일 URL")
        String thumbnailUrl,
        @Schema(description = "파일명")
        String fileName,
        @Schema(description = "촬영 시각")
        Instant takenAt,
        @Schema(description = "정렬 순서")
        int sortOrder,
        @Schema(description = "대표 사진 여부")
        boolean representative
) {
}
