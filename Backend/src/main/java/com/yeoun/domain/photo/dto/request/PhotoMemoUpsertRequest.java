package com.yeoun.domain.photo.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PhotoMemoUpsertRequest(
        @Schema(description = "사진 메모 내용", example = "광안리 야경이 진짜 예뻤다")
        @NotBlank(message = "Memo content is required.")
        @Size(max = 1000, message = "Memo content must be 1000 characters or fewer.")
        String content
) {
}
