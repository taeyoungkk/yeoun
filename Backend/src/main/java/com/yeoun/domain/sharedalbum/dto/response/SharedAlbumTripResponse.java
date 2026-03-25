package com.yeoun.domain.sharedalbum.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record SharedAlbumTripResponse(
        @Schema(description = "이 여행에 공유 앨범이 이미 생성되어 있는지 여부")
        boolean exists,
        @Schema(description = "공유 앨범이 존재할 경우 첫 화면에 필요한 요약 정보")
        SharedAlbumSummaryResponse sharedAlbum
) {
}
