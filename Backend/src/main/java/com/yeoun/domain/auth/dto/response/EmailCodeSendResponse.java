package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record EmailCodeSendResponse(
        @Schema(description = "Whether the verification code was sent")
        boolean sent,
        @Schema(description = "Response message")
        String message
) {
}
