package com.yeoun.domain.photo.dto.response;

import com.yeoun.domain.photo.entity.PhotoMemo;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record PhotoDetailMyMemoResponse(
        @Schema(description = "메모 내용")
        String content,
        @Schema(description = "메모 수정 시각")
        Instant updatedAt
) {

    public static PhotoDetailMyMemoResponse from(PhotoMemo photoMemo) {
        return new PhotoDetailMyMemoResponse(
                photoMemo.getContent(),
                photoMemo.getUpdatedAt()
        );
    }
}
