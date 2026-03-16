package com.yeoun.domain.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
        @Schema(description = "현재 비밀번호", example = "Password123!")
        @NotBlank(message = "Current password is required.")
        String currentPassword,

        @Schema(description = "새 비밀번호", example = "NewPassword123!")
        @NotBlank(message = "New password is required.")
        String newPassword
) {
}
