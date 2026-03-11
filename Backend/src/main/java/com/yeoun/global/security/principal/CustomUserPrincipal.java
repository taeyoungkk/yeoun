package com.yeoun.global.security.principal;

import com.yeoun.domain.user.entity.UserRole;

import java.util.UUID;

public record CustomUserPrincipal(UUID userId, UserRole role) {
}
