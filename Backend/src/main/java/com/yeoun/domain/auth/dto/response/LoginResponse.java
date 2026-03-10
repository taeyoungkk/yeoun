package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record LoginResponse(
        @Schema(description = "로그인 사용자 정보")
        UserSummary user,
        @Schema(description = "발급된 인증 토큰")
        AuthTokenResponse tokens
) {
    public record UserSummary(
            @Schema(description = "사용자 ID(UUID)", example = "11111111-1111-1111-1111-111111111111")
            UUID userId,
            @Schema(description = "사용자 이메일", example = "test@ssafy.com")
            String email,
            @Schema(description = "닉네임", example = "테스트")
            String nickname
    ) {
    }
}
