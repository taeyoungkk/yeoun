package com.yeoun.domain.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record GoogleLoginRequest(
        @Schema(description = "구글 로그인 후 전달받은 ID 토큰", example = "google-id-token")
        @NotBlank(message = "idToken은 필수입니다.")
        String idToken
) {
}
