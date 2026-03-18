package com.yeoun.domain.photo.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record PhotoSyncRequest(
        @Schema(description = "동기화 대상 사진 메타데이터 목록")
        @NotEmpty(message = "items is required.")
        List<@Valid PhotoSyncItemRequest> items
) {
}
