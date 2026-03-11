package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record AuthTokenResponse(
        @Schema(description = "액세스 토큰(JWT)")
        String accessToken,
        @Schema(description = "리프레시 토큰(JWT)")
        String refreshToken,
        @Schema(description = "토큰 타입", example = "Bearer")
        String tokenType,
        @Schema(description = "액세스 토큰 만료 시간(초)", example = "1800")
        long expiresIn
) {
}
