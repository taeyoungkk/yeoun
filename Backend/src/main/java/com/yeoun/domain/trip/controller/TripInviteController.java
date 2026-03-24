package com.yeoun.domain.trip.controller;

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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trip-invites")
@Tag(name = "Trip Invite", description = "여행 초대 API")
public class TripInviteController {

    private final TripInviteService tripInviteService;

    public TripInviteController(TripInviteService tripInviteService) {
        this.tripInviteService = tripInviteService;
    }

    @GetMapping("/{inviteToken}")
    @Operation(
            summary = "초대 상세 조회(토큰)",
            description = "공유 링크/딥링크로 진입한 경우 사용하는 API입니다. inviteToken으로 여행 초대 정보를 조회합니다."
    )
    public ApiResponse<TripInviteDetailResponse> getTripInviteDetail(
            @PathVariable("inviteToken") String inviteToken
    ) {
        TripInviteDetailResponse response = tripInviteService.getInviteDetail(inviteToken);
        return ApiResponse.ok(response);
    }

    @PostMapping("/{inviteToken}/accept")
    @Operation(
            summary = "초대 수락(토큰)",
            description = "공유 링크/딥링크 진입 흐름에서 사용합니다. inviteToken으로 초대를 수락합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<TripInviteAcceptResponse> acceptInvite(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("inviteToken") String inviteToken
    ) {
        TripInviteAcceptResponse response = tripInviteService.acceptInvite(principal.userId(), inviteToken);
        return ApiResponse.ok(response);
    }

    @PostMapping("/{inviteToken}/decline")
    @Operation(
            summary = "초대 거절(토큰)",
            description = "공유 링크/딥링크 진입 흐름에서 사용합니다. inviteToken으로 초대를 거절합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<TripInviteDeclineResponse> declineInvite(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("inviteToken") String inviteToken
    ) {
        TripInviteDeclineResponse response = tripInviteService.declineInvite(principal.userId(), inviteToken);
        return ApiResponse.ok(response);
    }

    @PostMapping("/id/{tripInviteId}/accept")
    @Operation(
            summary = "초대 수락(ID)",
            description = "인앱 알림함 액션에서 사용합니다. 알림의 resourceId(tripInviteId)로 초대를 수락합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<TripInviteAcceptResponse> acceptInviteById(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripInviteId") UUID tripInviteId
    ) {
        TripInviteAcceptResponse response = tripInviteService.acceptInviteById(principal.userId(), tripInviteId);
        return ApiResponse.ok(response);
    }

    @PostMapping("/id/{tripInviteId}/decline")
    @Operation(
            summary = "초대 거절(ID)",
            description = "인앱 알림함 액션에서 사용합니다. 알림의 resourceId(tripInviteId)로 초대를 거절합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<TripInviteDeclineResponse> declineInviteById(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripInviteId") UUID tripInviteId
    ) {
        TripInviteDeclineResponse response = tripInviteService.declineInviteById(principal.userId(), tripInviteId);
        return ApiResponse.ok(response);
    }
}
