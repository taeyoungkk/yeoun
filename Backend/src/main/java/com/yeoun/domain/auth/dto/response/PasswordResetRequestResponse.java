package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record PasswordResetRequestResponse(
        @Schema(description = "요청 성공 여부")
        boolean success,

        @Schema(description = "결과 메시지")
        String message
) {
}
