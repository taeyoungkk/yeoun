package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record EmailVerificationResponse(
        @Schema(description = "Whether the email is verified")
        boolean verified,
        @Schema(description = "Response message")
        String message
) {
}
