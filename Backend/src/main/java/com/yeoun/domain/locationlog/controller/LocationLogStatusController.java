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
@Tag(name = "LocationLog", description = "?꾩튂 濡쒓렇 ?섏쭛 API")
@SecurityRequirement(name = "bearerAuth")
public class LocationLogStatusController {

    private final TripProcessingStatusService tripProcessingStatusService;

    public LocationLogStatusController(TripProcessingStatusService tripProcessingStatusService) {
        this.tripProcessingStatusService = tripProcessingStatusService;
    }

    @GetMapping
    @Operation(summary = "?꾩튂 濡쒓렇 泥섎━ ?곹깭 議고쉶", description = "?ъ슜??泥⑥닔 ?섏쭛 ?붿껌 ?대썑 trip_processing_statuses 湲곕컲 ?곹깭瑜?polling ?⑸땲??")
    public ApiResponse<LocationLogProcessingStatusResponse> getStatus(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        LocationLogProcessingStatusResponse response =
                tripProcessingStatusService.getLocationLogStatus(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }
}
