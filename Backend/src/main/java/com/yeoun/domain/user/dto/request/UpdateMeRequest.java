package com.yeoun.domain.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateMeRequest(
        @Schema(description = "Nickname", example = "yeoun")
        @Size(min = 2, max = 10, message = "Nickname must be between 2 and 10 characters.")
        @Pattern(regexp = "^[A-Za-z0-9가-힣]{2,10}$", message = "Nickname can contain only Korean, English letters, and numbers.")
        String nickname
) {
}
