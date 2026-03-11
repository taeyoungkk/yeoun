package com.yeoun.domain.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SendEmailCodeRequest(
        @Schema(description = "Email address for verification", example = "user@example.com")
        @NotBlank(message = "Email is required.")
        @Email(message = "Email format is invalid.")
        String email
) {
}
