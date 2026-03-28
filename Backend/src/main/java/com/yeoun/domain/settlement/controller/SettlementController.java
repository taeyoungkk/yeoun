package com.yeoun.domain.settlement.controller;

import com.yeoun.domain.settlement.dto.request.SettlementCreateRequest;
import com.yeoun.domain.settlement.dto.response.SettlementCreateResponse;
import com.yeoun.domain.settlement.dto.response.SettlementDetailResponse;
import com.yeoun.domain.settlement.dto.response.SettlementFinalizeResponse;
import com.yeoun.domain.settlement.dto.response.SettlementListResponse;
import com.yeoun.domain.settlement.service.SettlementCommandService;
import com.yeoun.domain.settlement.service.SettlementLatestService;
import com.yeoun.domain.settlement.service.SettlementQueryService;
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
@Tag(name = "Settlement", description = "정산 API")
@SecurityRequirement(name = "bearerAuth")
public class SettlementController {

    private final SettlementCommandService settlementCommandService;
    private final SettlementLatestService settlementLatestService;
    private final SettlementQueryService settlementQueryService;

    public SettlementController(
            SettlementCommandService settlementCommandService,
            SettlementLatestService settlementLatestService,
            SettlementQueryService settlementQueryService
    ) {
        this.settlementCommandService = settlementCommandService;
        this.settlementLatestService = settlementLatestService;
        this.settlementQueryService = settlementQueryService;
    }

    @PostMapping("/trips/{tripId}/settlements")
    @Operation(summary = "정산 생성", description = "확정된 비용을 기준으로 새 정산 결과를 생성합니다.")
    public ApiResponse<SettlementCreateResponse> createSettlement(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId,
            @Valid @RequestBody(required = false) SettlementCreateRequest request
    ) {
        SettlementCreateRequest safeRequest = request == null ? new SettlementCreateRequest(null) : request;
        SettlementCreateResponse response = settlementCommandService.createSettlement(principal.userId(), tripId, safeRequest);
        return ApiResponse.ok(response);
    }

    @GetMapping("/trips/{tripId}/settlements")
    @Operation(summary = "정산 목록 조회", description = "여행의 정산 결과 목록을 최신 버전 순으로 조회합니다.")
    public ApiResponse<SettlementListResponse> getTripSettlements(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        SettlementListResponse response = settlementQueryService.getTripSettlements(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/trips/{tripId}/settlements/latest")
    @Operation(summary = "최신 정산 조회", description = "현재 확정 지출 상태와 일치하는 최신 정산을 조회하고, 없으면 새로 계산해 반환합니다.")
    public ApiResponse<SettlementDetailResponse> getLatestSettlement(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        SettlementDetailResponse response = settlementLatestService.getLatestSettlement(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/settlements/{settlementId}")
    @Operation(summary = "정산 상세 조회", description = "정산 결과의 멤버별 요약과 송금 관계를 상세 조회합니다.")
    public ApiResponse<SettlementDetailResponse> getSettlementDetail(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("settlementId") UUID settlementId
    ) {
        SettlementDetailResponse response = settlementQueryService.getSettlementDetail(principal.userId(), settlementId);
        return ApiResponse.ok(response);
    }

    @PostMapping("/settlements/{settlementId}/finalize")
    @Operation(summary = "정산 확정", description = "DRAFT 상태의 정산안을 최종 확정합니다.")
    public ApiResponse<SettlementFinalizeResponse> finalizeSettlement(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("settlementId") UUID settlementId
    ) {
        SettlementFinalizeResponse response = settlementCommandService.finalizeSettlement(principal.userId(), settlementId);
        return ApiResponse.ok(response);
    }
}
