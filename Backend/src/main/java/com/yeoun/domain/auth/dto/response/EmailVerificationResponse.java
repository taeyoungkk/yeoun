package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record EmailVerificationResponse(
        @Schema(description = "이메일 인증 완료 여부")
        boolean verified,
        @Schema(description = "응답 메시지")
        String message
) {
}
