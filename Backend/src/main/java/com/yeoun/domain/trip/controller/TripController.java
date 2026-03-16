package com.yeoun.domain.trip.controller;

import com.yeoun.domain.trip.dto.request.TripCreateRequest;
import com.yeoun.domain.trip.dto.request.TripInviteUsersRequest;
import com.yeoun.domain.trip.dto.response.TripCreateResponse;
import com.yeoun.domain.trip.dto.response.TripDetailResponse;
import com.yeoun.domain.trip.dto.response.TripInviteUsersResponse;
import com.yeoun.domain.trip.dto.response.TripListResponse;
import com.yeoun.domain.trip.service.TripService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

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

    @PostMapping("/{tripId}/invites/users")
    @Operation(summary = "사용자 직접 초대", description = "여행 소유자가 특정 사용자를 여행에 초대합니다.")
    public ApiResponse<TripInviteUsersResponse> inviteUsers(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") java.util.UUID tripId,
            @Valid @RequestBody TripInviteUsersRequest request
    ) {
        TripInviteUsersResponse response = tripService.inviteUsers(principal.userId(), tripId, request);
        return ApiResponse.ok(response);
    }

    @GetMapping
    @Operation(summary = "여행 목록 조회", description = "내가 생성했거나 현재 참여 중인 여행 목록을 조회합니다.")
    public ApiResponse<TripListResponse> getTrips(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        TripListResponse response = tripService.getTrips(principal.userId());
        return ApiResponse.ok(response);
    }

    @GetMapping("/{tripId}")
    @Operation(summary = "여행 상세 조회", description = "여행 상세 정보를 조회합니다.")
    public ApiResponse<TripDetailResponse> getTripDetail(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") java.util.UUID tripId
    ) {
        TripDetailResponse response = tripService.getTripDetail(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }
}
