package com.yeoun.domain.locationlog.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record LocationLogBatchUploadRequest(
        @Schema(description = "일괄 업로드할 위치 로그 목록")
        @NotEmpty(message = "logs must not be empty.")
        List<@Valid LocationLogUploadItemRequest> logs
) {
}
