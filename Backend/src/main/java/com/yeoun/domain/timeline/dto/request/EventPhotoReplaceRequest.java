package com.yeoun.domain.timeline.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record EventPhotoReplaceRequest(
        @Schema(description = "이벤트에 연결할 사진 목록. 배열 순서가 정렬 순서가 됩니다.")
        @NotNull(message = "photos is required.")
        @Size(min = 1, message = "At least one photo is required.")
        List<@Valid EventPhotoReplaceItemRequest> photos
) {
}
