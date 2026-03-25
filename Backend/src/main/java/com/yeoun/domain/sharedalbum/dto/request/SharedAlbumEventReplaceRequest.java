package com.yeoun.domain.sharedalbum.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record SharedAlbumEventReplaceRequest(
        @Schema(description = "공유 앨범에 노출할 이벤트 ID 목록")
        @NotNull(message = "Event ids are required.")
        List<UUID> eventIds
) {
}
