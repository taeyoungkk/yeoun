package com.yeoun.domain.receipt.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ReceiptOcrCreateRequest(
        @NotBlank(message = "Image url is required.")
        @Size(max = 2000, message = "Image url must be 2000 characters or fewer.")
        String imageUrl,

        @Size(min = 3, max = 3, message = "Currency code must be 3 characters.")
        String currencyCode,

        @Pattern(
                regexp = "^[a-z]{2,3}(?:-[A-Z]{2})?$",
                message = "Locale must be in language-country format."
        )
        String locale
) {
}
