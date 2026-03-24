package com.yeoun.domain.paymentimport.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record FinanceCardCvcUpsertRequest(
        @NotBlank(message = "CVC is required.")
        @Pattern(regexp = "\\d{3}", message = "CVC must be exactly 3 digits.")
        String cvc
) {
}
