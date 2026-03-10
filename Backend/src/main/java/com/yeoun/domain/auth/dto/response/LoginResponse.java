package com.yeoun.domain.auth.dto.response;

import java.util.UUID;

public record LoginResponse(
        UserSummary user,
        AuthTokenResponse tokens
) {
    public record UserSummary(
            UUID userId,
            String email,
            String nickname
    ) {
    }
}
