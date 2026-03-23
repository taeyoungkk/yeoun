package com.yeoun.domain.locationlog.controller;

import com.yeoun.domain.locationlog.dto.response.LocationLogProcessingStatusResponse;
import com.yeoun.domain.tripprocessing.service.TripProcessingStatusService;
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
@RequestMapping("/api/v1/trips/{tripId}/location-log-status")
@Tag(name = "LocationLog", description = "위치 로그 처리 상태 조회 API")
@SecurityRequirement(name = "bearerAuth")
public class LocationLogStatusController {

    private final TripProcessingStatusService tripProcessingStatusService;

    public LocationLogStatusController(TripProcessingStatusService tripProcessingStatusService) {
        this.tripProcessingStatusService = tripProcessingStatusService;
    }

    @GetMapping
    @Operation(summary = "위치 로그 처리 상태 조회", description = "위치 로그 업로드 이후 trip_processing_statuses 기준 상태를 polling 할 때 사용합니다.")
    public ApiResponse<LocationLogProcessingStatusResponse> getStatus(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        LocationLogProcessingStatusResponse response =
                tripProcessingStatusService.getLocationLogStatus(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }
}
