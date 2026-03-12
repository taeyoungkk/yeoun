package com.yeoun.domain.trip.controller;

import com.yeoun.domain.trip.dto.request.TripCreateRequest;
import com.yeoun.domain.trip.dto.response.TripCreateResponse;
import com.yeoun.domain.trip.service.TripService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/trips")
@Tag(name = "Trip", description = "여행 API")
@SecurityRequirement(name = "bearerAuth")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @PostMapping
    @Operation(summary = "여행 생성", description = "새 여행을 생성하고 생성자를 자동으로 참여 멤버(ACCEPTED)로 등록합니다.")
    public ApiResponse<TripCreateResponse> createTrip(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @Valid @RequestBody TripCreateRequest request
    ) {
        TripCreateResponse response = tripService.createTrip(principal.userId(), request);
        return ApiResponse.ok(response);
    }
}
