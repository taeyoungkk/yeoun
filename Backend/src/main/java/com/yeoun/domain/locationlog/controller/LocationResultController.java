package com.yeoun.domain.locationlog.controller;

import com.yeoun.domain.locationlog.dto.response.LocationPlaceListResponse;
import com.yeoun.domain.locationlog.dto.response.LocationRouteDayListResponse;
import com.yeoun.domain.locationlog.service.LocationResultQueryService;
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
@RequestMapping("/api/v1/trips/{tripId}")
@Tag(name = "LocationResult", description = "워커 위치 처리 결과 조회 API")
@SecurityRequirement(name = "bearerAuth")
public class LocationResultController {

    private final LocationResultQueryService locationResultQueryService;

    public LocationResultController(LocationResultQueryService locationResultQueryService) {
        this.locationResultQueryService = locationResultQueryService;
    }

    @GetMapping("/location-route-days")
    @Operation(summary = "위치 route day 조회", description = "워커가 생성한 여행별 이동 경로 day 결과를 조회합니다.")
    public ApiResponse<LocationRouteDayListResponse> getRouteDays(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        LocationRouteDayListResponse response = locationResultQueryService.getRouteDays(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/location-places")
    @Operation(summary = "위치 place 조회", description = "워커가 생성한 여행별 방문 장소 결과를 조회합니다.")
    public ApiResponse<LocationPlaceListResponse> getPlaces(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        LocationPlaceListResponse response = locationResultQueryService.getPlaces(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }
}
