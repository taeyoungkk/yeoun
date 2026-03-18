package com.yeoun.domain.photo.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.Instant;

public record PhotoSyncItemRequest(
        @Schema(description = "클라이언트 파일명", example = "IMG_0001.JPG")
        @NotBlank(message = "fileName is required.")
        String fileName,
        @Schema(description = "촬영 시각")
        Instant takenAt,
        @Schema(description = "촬영 타임존", example = "Asia/Seoul")
        String takenTimezone,
        @Schema(description = "EXIF 위도")
        BigDecimal exifLatitude,
        @Schema(description = "EXIF 경도")
        BigDecimal exifLongitude
) {
}
