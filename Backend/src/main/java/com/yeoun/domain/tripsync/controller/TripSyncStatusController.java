package com.yeoun.domain.tripsync.controller;

import com.yeoun.domain.tripsync.dto.response.TripSyncStatusResponse;
import com.yeoun.domain.tripsync.service.TripSyncStatusService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/sync-status")
@Tag(name = "TripSyncStatus", description = "여행 동기화 상태 조회 API")
@SecurityRequirement(name = "bearerAuth")
public class TripSyncStatusController {

    private final TripSyncStatusService tripSyncStatusService;

    public TripSyncStatusController(TripSyncStatusService tripSyncStatusService) {
        this.tripSyncStatusService = tripSyncStatusService;
    }

    @GetMapping
    @Operation(summary = "여행 동기화 상태 조회", description = "여행의 경로, 타임라인, 사진 동기화 상태와 버전을 조회합니다.")
    public ApiResponse<TripSyncStatusResponse> getTripSyncStatus(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        TripSyncStatusResponse response = tripSyncStatusService.getTripSyncStatus(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }
}
