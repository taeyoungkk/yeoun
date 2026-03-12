package com.yeoun.domain.user.dto.response;

import com.yeoun.domain.user.entity.UserRole;
import com.yeoun.domain.user.entity.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record MeResponse(
        @Schema(description = "사용자 ID")
        UUID userId,

        @Schema(description = "이메일")
        String email,

        @Schema(description = "닉네임")
        String nickname,

        @Schema(description = "프로필 이미지 URL")
        String profileImageUrl,

        @Schema(description = "Timezone(시간대)")
        String timezone,

        @Schema(description = "권한")
        UserRole role,

        @Schema(description = "상태")
        UserStatus status
) {
}
