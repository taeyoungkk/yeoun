package com.yeoun.domain.timeline.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record EventPhotoReplaceItemRequest(
        @Schema(description = "사진 ID")
        @NotNull(message = "photoId is required.")
        UUID photoId,

        @Schema(description = "대표 사진 여부", example = "false")
        @NotNull(message = "isRepresentative is required.")
        Boolean isRepresentative
) {
}
