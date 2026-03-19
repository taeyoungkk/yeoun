package com.yeoun.domain.photo.dto.response;

import com.yeoun.domain.photo.entity.PhotoMemo;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record PhotoMemoResponse(
        @Schema(description = "사진 메모 ID")
        UUID photoMemoId,
        @Schema(description = "사진 ID")
        UUID photoId,
        @Schema(description = "작성 사용자 ID")
        UUID userId,
        @Schema(description = "메모 내용")
        String content,
        @Schema(description = "생성 시각")
        Instant createdAt,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {

    public static PhotoMemoResponse from(PhotoMemo photoMemo) {
        return new PhotoMemoResponse(
                photoMemo.getPhotoMemoId(),
                photoMemo.getPhotoId(),
                photoMemo.getUserId(),
                photoMemo.getContent(),
                photoMemo.getCreatedAt(),
                photoMemo.getUpdatedAt()
        );
    }
}
