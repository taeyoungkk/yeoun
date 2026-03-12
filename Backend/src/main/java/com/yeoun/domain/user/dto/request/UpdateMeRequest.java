package com.yeoun.domain.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

public record UpdateMeRequest(
        @Schema(description = "닉네임", example = "yeoun")
        @Size(min = 2, max = 20, message = "Nickname must be between 2 and 20 characters.")
        String nickname,

        @Schema(description = "프로필 이미지 URL", example = "https://cdn.example.com/profiles/user.png")
        @Size(max = 500, message = "Profile image URL must be 500 characters or fewer.")
        String profileImageUrl
) {
}
