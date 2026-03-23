package com.yeoun.domain.photo.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record TripPhotoListResponse(
        @Schema(description = "사진 목록")
        List<TripPhotoListItemResponse> items,
        @Schema(description = "다음 페이지 조회용 커서. hasNext가 true일 때만 값이 내려옵니다.")
        String nextCursor,
        @Schema(description = "다음 페이지 존재 여부")
        boolean hasNext
) {
}
