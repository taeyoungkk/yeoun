package com.yeoun.domain.sharedalbum.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record SharedAlbumMemberReplaceRequest(
        @Schema(description = "공유 앨범에 접근 가능한 사용자 ID 목록")
        @NotNull(message = "User ids are required.")
        List<UUID> userIds
) {
}
