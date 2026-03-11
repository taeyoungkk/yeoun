package com.yeoun.domain.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequest(
        @Schema(description = "재발급에 사용할 refresh token")
        @NotBlank(message = "Refresh token is required.")
        String refreshToken
) {
}
