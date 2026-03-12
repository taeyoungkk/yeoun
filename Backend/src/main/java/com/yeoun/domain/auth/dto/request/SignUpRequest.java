package com.yeoun.domain.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignUpRequest(
        @Schema(description = "Sign-up email", example = "user@example.com")
        @NotBlank(message = "Email is required.")
        @Email(message = "Email format is invalid.")
        String email,

        @Schema(description = "Sign-up password", example = "Password123!")
        String password,

        @Schema(description = "Sign-up nickname", example = "yeoun")
        @NotBlank(message = "Nickname is required.")
        @Size(min = 2, max = 10, message = "Nickname must be between 2 and 10 characters.")
        @Pattern(regexp = "^[A-Za-z0-9가-힣]{2,10}$", message = "Nickname can contain only Korean, English letters, and numbers.")
        String nickname
) {
}
