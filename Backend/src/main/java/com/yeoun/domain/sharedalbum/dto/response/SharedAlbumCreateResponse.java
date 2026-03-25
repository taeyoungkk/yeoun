package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record SharedAlbumCreateResponse(
        @Schema(description = "이번 요청으로 새로 생성되었는지 여부")
        boolean created,
        @Schema(description = "생성 후 반환되는 공유 앨범 요약 정보")
        SharedAlbumSummaryResponse sharedAlbum
) {
}
