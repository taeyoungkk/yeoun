package com.yeoun.domain.paymentimport.controller;

import com.yeoun.domain.paymentimport.dto.request.FinanceCardCvcUpsertRequest;
import com.yeoun.domain.paymentimport.dto.response.UserFinanceCardItemResponse;
import com.yeoun.domain.paymentimport.dto.response.UserFinanceProfileResponse;
import com.yeoun.domain.paymentimport.service.UserFinanceProfileService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users/me/finance-profile")
@Tag(name = "UserFinanceProfile", description = "사용자 금융 프로필 API")
@SecurityRequirement(name = "bearerAuth")
public class UserFinanceProfileController {

    private final UserFinanceProfileService userFinanceProfileService;

    public UserFinanceProfileController(UserFinanceProfileService userFinanceProfileService) {
        this.userFinanceProfileService = userFinanceProfileService;
    }

    @GetMapping
    @Operation(summary = "내 금융 프로필 조회", description = "현재 사용자에 연결된 금융 userKey, 계좌, 카드 목록을 조회합니다.")
    public ApiResponse<UserFinanceProfileResponse> getMyFinanceProfile(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        return ApiResponse.ok(userFinanceProfileService.getMyFinanceProfile(principal.userId()));
    }

    @PostMapping("/sync")
    @Operation(summary = "내 금융 프로필 동기화", description = "금융망 회원을 생성/조회하고 계좌 및 카드 목록을 동기화합니다.")
    public ApiResponse<UserFinanceProfileResponse> syncMyFinanceProfile(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        return ApiResponse.ok(userFinanceProfileService.syncMyFinanceProfile(principal.userId()));
    }

    @PatchMapping("/cards/{financeCardId}/cvc")
    @Operation(summary = "카드 CVC 등록", description = "카드 결제내역 조회를 위해 카드 CVC를 등록하거나 수정합니다.")
    public ApiResponse<UserFinanceCardItemResponse> upsertCardCvc(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("financeCardId") UUID financeCardId,
            @Valid @RequestBody FinanceCardCvcUpsertRequest request
    ) {
        return ApiResponse.ok(userFinanceProfileService.upsertCardCvc(principal.userId(), financeCardId, request.cvc()));
    }
}
