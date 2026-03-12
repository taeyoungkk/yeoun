package com.yeoun.domain.trip.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record TripInviteUsersResponse(
        @Schema(description = "초대 생성된 사용자 ID 목록")
        List<UUID> invitedUserIds,

        @Schema(description = "초대에서 제외된 사용자 ID 목록(중복/자기 자신/존재하지 않는 사용자)")
        List<UUID> skippedUserIds
) {
}
