package com.yeoun.domain.locationlog.dto.request;

import com.yeoun.domain.locationlog.entity.LocationLogSource;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

public record LocationLogUploadItemRequest(
        @Schema(description = "클라이언트 생성 위치 로그 UUID", example = "550e8400-e29b-41d4-a716-446655440000")
        @NotBlank(message = "clientLogUuid is required.")
        @Size(max = 100, message = "clientLogUuid must be 100 characters or fewer.")
        String clientLogUuid,

        @Schema(description = "위치 기록 시각", example = "2026-03-17T10:00:00Z")
        @NotNull(message = "recordedAt is required.")
        Instant recordedAt,

        @Schema(description = "위도", example = "37.5665000")
        @NotNull(message = "latitude is required.")
        @DecimalMin(value = "-90.0", message = "latitude must be greater than or equal to -90.")
        @DecimalMax(value = "90.0", message = "latitude must be less than or equal to 90.")
        @Digits(integer = 3, fraction = 7, message = "latitude precision is invalid.")
        BigDecimal latitude,

        @Schema(description = "경도", example = "126.9780000")
        @NotNull(message = "longitude is required.")
        @DecimalMin(value = "-180.0", message = "longitude must be greater than or equal to -180.")
        @DecimalMax(value = "180.0", message = "longitude must be less than or equal to 180.")
        @Digits(integer = 3, fraction = 7, message = "longitude precision is invalid.")
        BigDecimal longitude,

        @Schema(description = "정확도(m)", example = "8.50")
        @NotNull(message = "accuracyM is required.")
        @DecimalMin(value = "0.0", inclusive = false, message = "accuracyM must be greater than 0.")
        @Digits(integer = 6, fraction = 2, message = "accuracyM precision is invalid.")
        BigDecimal accuracyM,

        @Schema(description = "속도(m/s)", example = "1.25")
        @DecimalMin(value = "0.0", message = "speedMps must be greater than or equal to 0.")
        @Digits(integer = 6, fraction = 2, message = "speedMps precision is invalid.")
        BigDecimal speedMps,

        @Schema(description = "방향(0~360 미만)", example = "210.50")
        @DecimalMin(value = "0.0", message = "heading must be greater than or equal to 0.")
        @DecimalMax(value = "359.99", message = "heading must be less than 360.")
        @Digits(integer = 3, fraction = 2, message = "heading precision is invalid.")
        BigDecimal heading,

        @Schema(description = "수집 출처", example = "GPS")
        @NotNull(message = "source is required.")
        LocationLogSource source
) {
}
