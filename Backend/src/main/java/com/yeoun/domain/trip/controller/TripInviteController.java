package com.yeoun.domain.trip.controller;

import com.yeoun.domain.trip.dto.response.ReceivedTripInviteListResponse;
import com.yeoun.domain.trip.dto.response.TripInviteAcceptResponse;
import com.yeoun.domain.trip.dto.response.TripInviteDeclineResponse;
import com.yeoun.domain.trip.dto.response.TripInviteDetailResponse;
import com.yeoun.domain.trip.service.TripInviteService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/trip-invites")
@Tag(name = "Trip Invite", description = "여행 초대 API")
public class TripInviteController {

    private final TripInviteService tripInviteService;

    public TripInviteController(TripInviteService tripInviteService) {
        this.tripInviteService = tripInviteService;
    }

    @GetMapping("/received")
    @Operation(
            summary = "내가 받은 여행 초대 목록 조회",
            description = "현재 로그인한 사용자가 받은 유효한 직접 초대 목록을 조회합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<ReceivedTripInviteListResponse> getReceivedTripInvites(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        ReceivedTripInviteListResponse response = tripInviteService.getReceivedInvites(principal.userId());
        return ApiResponse.ok(response);
    }

    @GetMapping("/{inviteToken}")
    @Operation(summary = "초대 상세 조회", description = "링크 초대 또는 직접 초대 토큰으로 여행 초대 정보를 조회합니다.")
    public ApiResponse<TripInviteDetailResponse> getTripInviteDetail(
            @PathVariable("inviteToken") String inviteToken
    ) {
        TripInviteDetailResponse response = tripInviteService.getInviteDetail(inviteToken);
        return ApiResponse.ok(response);
    }

    @PostMapping("/{inviteToken}/accept")
    @Operation(summary = "초대 수락", description = "링크 초대 또는 직접 초대를 수락하고 여행 참여자로 등록합니다. 직접 초대는 초대 대상 사용자만 수락할 수 있습니다.")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<TripInviteAcceptResponse> acceptInvite(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("inviteToken") String inviteToken
    ) {
        TripInviteAcceptResponse response = tripInviteService.acceptInvite(principal.userId(), inviteToken);
        return ApiResponse.ok(response);
    }

    @PostMapping("/{inviteToken}/decline")
    @Operation(summary = "초대 거절", description = "링크 초대 또는 직접 초대를 거절합니다. 직접 초대는 초대 대상 사용자만 거절할 수 있습니다.")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<TripInviteDeclineResponse> declineInvite(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("inviteToken") String inviteToken
    ) {
        TripInviteDeclineResponse response = tripInviteService.declineInvite(principal.userId(), inviteToken);
        return ApiResponse.ok(response);
    }
}
