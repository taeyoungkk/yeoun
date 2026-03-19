package com.yeoun.domain.photo.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PhotoDetailResponse(
        @Schema(description = "사진 ID")
        UUID photoId,
        @Schema(description = "사진 소유자 ID")
        UUID ownerUserId,
        @Schema(description = "여행 ID")
        UUID tripId,
        @Schema(description = "연결된 이벤트 ID")
        UUID eventId,
        @Schema(description = "원본 이미지 URL 또는 key")
        String storageUrl,
        @Schema(description = "썸네일 URL 또는 key")
        String thumbnailUrl,
        @Schema(description = "파일명")
        String fileName,
        @Schema(description = "MIME 타입")
        String mimeType,
        @Schema(description = "가로 크기")
        Integer width,
        @Schema(description = "세로 크기")
        Integer height,
        @Schema(description = "촬영 시각")
        Instant takenAt,
        @Schema(description = "촬영 타임존")
        String takenTimezone,
        @Schema(description = "EXIF 위도")
        BigDecimal exifLatitude,
        @Schema(description = "EXIF 경도")
        BigDecimal exifLongitude,
        @Schema(description = "제외 여부")
        boolean isExcluded,
        @Schema(description = "현재 로그인한 사용자의 사진 메모")
        PhotoDetailMyMemoResponse myMemo
) {
}
