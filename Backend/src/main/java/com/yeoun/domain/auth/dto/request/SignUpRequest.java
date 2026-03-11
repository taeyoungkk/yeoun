package com.yeoun.domain.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignUpRequest(
        @Schema(description = "회원가입 이메일", example = "user@example.com")
        @NotBlank(message = "Email is required.")
        @Email(message = "Email format is invalid.")
        String email,

        @Schema(description = "회원가입 비밀번호", example = "Password123!")
        @NotBlank(message = "Password is required.")
        @Size(min = 8, max = 64, message = "Password must be between 8 and 64 characters.")
        String password,

        @Schema(description = "회원가입 닉네임", example = "yeoun")
        @NotBlank(message = "Nickname is required.")
        @Size(min = 2, max = 20, message = "Nickname must be between 2 and 20 characters.")
        String nickname
) {
}
