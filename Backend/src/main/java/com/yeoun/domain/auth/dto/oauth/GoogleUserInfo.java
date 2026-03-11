package com.yeoun.domain.auth.dto.oauth;

public record GoogleUserInfo(
        String sub,
        String email,
        boolean emailVerified,
        String name,
        String picture
) {
}
