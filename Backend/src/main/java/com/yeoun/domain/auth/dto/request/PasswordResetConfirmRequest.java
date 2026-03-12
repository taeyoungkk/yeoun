package com.yeoun.domain.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PasswordResetConfirmRequest(
        @Schema(description = "Email to reset password", example = "user@example.com")
        @NotBlank(message = "Email is required.")
        @Email(message = "Email format is invalid.")
        String email,

        @Schema(description = "6-digit verification code", example = "123456")
        @NotBlank(message = "Verification code is required.")
        @Pattern(regexp = "^\\d{6}$", message = "Verification code format is invalid.")
        String code,

        @Schema(description = "New password", example = "Password123!")
        String newPassword
) {
}
