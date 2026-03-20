package com.yeoun.domain.timeline.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EventMemoUpsertRequest(
        @Schema(description = "이벤트 메모 내용", example = "야경이 정말 좋았고 바람이 많이 불었다.")
        @NotBlank(message = "Memo content is required.")
        @Size(max = 1000, message = "Memo content must be 1000 characters or fewer.")
        String content
) {
}
