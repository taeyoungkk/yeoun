package com.yeoun.domain.paymentimport.controller;

import com.yeoun.domain.paymentimport.dto.request.PaymentImportSelectRequest;
import com.yeoun.domain.paymentimport.dto.response.PaymentImportIgnoreResponse;
import com.yeoun.domain.paymentimport.dto.response.PaymentImportListResponse;
import com.yeoun.domain.paymentimport.dto.response.PaymentImportSelectResponse;
import com.yeoun.domain.paymentimport.service.PaymentImportCommandService;
import com.yeoun.domain.paymentimport.service.PaymentImportQueryService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "PaymentImport", description = "결제내역 후보 API")
@SecurityRequirement(name = "bearerAuth")
public class PaymentImportController {

    private final PaymentImportQueryService paymentImportQueryService;
    private final PaymentImportCommandService paymentImportCommandService;

    public PaymentImportController(
            PaymentImportQueryService paymentImportQueryService,
            PaymentImportCommandService paymentImportCommandService
    ) {
        this.paymentImportQueryService = paymentImportQueryService;
        this.paymentImportCommandService = paymentImportCommandService;
    }

    @GetMapping("/trips/{tripId}/payment-imports")
    @Operation(summary = "여행 결제내역 후보 조회", description = "현재 사용자 기준으로 해당 여행 기간과 관련 있어 보이는 결제내역 후보를 조회합니다.")
    public ApiResponse<PaymentImportListResponse> getTripPaymentImports(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        PaymentImportListResponse response = paymentImportQueryService.getTripPaymentImports(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/users/me/payment-imports")
    @Operation(summary = "내 결제내역 후보 조회", description = "현재 사용자의 전체 결제내역 후보 목록을 조회합니다.")
    public ApiResponse<PaymentImportListResponse> getMyPaymentImports(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        PaymentImportListResponse response = paymentImportQueryService.getMyPaymentImports(principal.userId());
        return ApiResponse.ok(response);
    }

    @PostMapping("/payment-imports/{paymentImportId}/select")
    @Operation(summary = "결제내역 후보 선택", description = "후보를 실제 여행 비용으로 확정하고 균등 분배 비용을 생성합니다.")
    public ApiResponse<PaymentImportSelectResponse> selectPaymentImport(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("paymentImportId") UUID paymentImportId,
            @Valid @RequestBody PaymentImportSelectRequest request
    ) {
        PaymentImportSelectResponse response = paymentImportCommandService.selectPaymentImport(
                principal.userId(),
                paymentImportId,
                request
        );
        return ApiResponse.ok(response);
    }

    @PostMapping("/payment-imports/{paymentImportId}/ignore")
    @Operation(summary = "결제내역 후보 무시", description = "결제내역 후보를 여행 비용 후보에서 제외합니다.")
    public ApiResponse<PaymentImportIgnoreResponse> ignorePaymentImport(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("paymentImportId") UUID paymentImportId
    ) {
        PaymentImportIgnoreResponse response = paymentImportCommandService.ignorePaymentImport(
                principal.userId(),
                paymentImportId
        );
        return ApiResponse.ok(response);
    }
}
