package com.yeoun.domain.sharedalbum.dto.request;

import com.yeoun.domain.sharedalbum.entity.SharedAlbumVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SharedAlbumUpdateRequest(
        @Schema(description = "공유 앨범 제목", example = "제주 여행 리포트")
        @Size(max = 255, message = "Shared album title must be 255 characters or fewer.")
        String title,
        @Schema(description = "대표 지역명", example = "제주")
        @Size(max = 100, message = "Region label must be 100 characters or fewer.")
        String regionLabel,
        @Schema(description = "공유 앨범 설명", example = "4박 5일 제주 여행 기록")
        String description,
        @Schema(description = "공유 범위", example = "MEMBERS")
        SharedAlbumVisibility visibility,
        @Schema(description = "커버 사진 ID")
        UUID coverPhotoId
) {
}
