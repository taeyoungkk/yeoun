package com.yeoun.domain.photo.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record PhotoUpdateRequest(
        @Schema(description = "여행 기록에서 사진 제외 여부", example = "true")
        @NotNull(message = "isExcluded is required.")
        Boolean isExcluded
) {
}
