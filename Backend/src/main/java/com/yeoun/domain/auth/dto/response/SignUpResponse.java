package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record SignUpResponse(
        @Schema(description = "회원가입한 사용자 정보")
        UserSummary user,
        @Schema(description = "회원가입 직후 발급된 인증 토큰")
        AuthTokenResponse tokens
) {
    public record UserSummary(
            @Schema(description = "사용자 ID(UUID)", example = "11111111-1111-1111-1111-111111111111")
            UUID userId,
            @Schema(description = "사용자 이메일", example = "user@example.com")
            String email,
            @Schema(description = "사용자 닉네임", example = "yeoun")
            String nickname
    ) {
    }
}
