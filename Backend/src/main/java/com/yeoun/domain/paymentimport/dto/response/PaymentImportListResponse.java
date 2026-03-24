package com.yeoun.domain.paymentimport.dto.response;

import java.util.List;

public record PaymentImportListResponse(
        List<PaymentImportItemResponse> items
) {
}
