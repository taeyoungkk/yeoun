package com.yeoun.domain.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record EmailCodeSendResponse(
        @Schema(description = "인증코드 발송 성공 여부")
        boolean sent,
        @Schema(description = "응답 메시지")
        String message
) {
}
