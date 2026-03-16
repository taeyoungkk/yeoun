package com.yeoun.domain.trip.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record TripInviteUsersRequest(
        @Schema(description = "초대할 사용자 ID 목록")
        @NotEmpty(message = "Invitee user ids are required.")
        List<UUID> inviteeUserIds
) {
}
