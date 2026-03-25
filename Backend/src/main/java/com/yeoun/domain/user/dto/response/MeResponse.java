package com.yeoun.domain.user.dto.response;

import com.yeoun.domain.user.entity.UserRole;
import com.yeoun.domain.user.entity.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record MeResponse(
        @Schema(description = "User ID")
        UUID userId,

        @Schema(description = "Email")
        String email,

        @Schema(description = "Nickname")
        String nickname,

        @Schema(description = "Profile image URL")
        String profileImageUrl,

        @Schema(description = "Timezone")
        String timezone,

        @Schema(description = "Account creation time")
        Instant createdAt,

        @Schema(description = "Role")
        UserRole role,

        @Schema(description = "Status")
        UserStatus status
) {
}
