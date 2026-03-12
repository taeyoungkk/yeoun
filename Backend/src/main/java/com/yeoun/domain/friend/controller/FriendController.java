package com.yeoun.domain.friend.controller;

import com.yeoun.domain.friend.dto.request.FriendRequestCreateRequest;
import com.yeoun.domain.friend.dto.response.FriendListResponse;
import com.yeoun.domain.friend.dto.response.FriendListResult;
import com.yeoun.domain.friend.dto.response.FriendRequestCreateResponse;
import com.yeoun.domain.friend.dto.response.FriendRequestListItemResponse;
import com.yeoun.domain.friend.dto.response.FriendRequestListResult;
import com.yeoun.domain.friend.dto.response.FriendSearchResponse;
import com.yeoun.domain.friend.dto.response.FriendSearchResult;
import com.yeoun.domain.friend.service.FriendCommandService;
import com.yeoun.domain.friend.service.FriendQueryService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/friends")
@Tag(name = "친구", description = "친구 관련 API")
@SecurityRequirement(name = "bearerAuth")
public class FriendController {

    private final FriendCommandService friendCommandService;
    private final FriendQueryService friendQueryService;

    public FriendController(
            FriendCommandService friendCommandService,
            FriendQueryService friendQueryService
    ) {
        this.friendCommandService = friendCommandService;
        this.friendQueryService = friendQueryService;
    }

    @PostMapping("/requests")
    @Operation(summary = "친구 요청 보내기", description = "다른 사용자에게 친구 요청을 보냅니다.")
    public ApiResponse<FriendRequestCreateResponse> createFriendRequest(
            @CurrentUser CustomUserPrincipal principal,
            @Valid @RequestBody FriendRequestCreateRequest request
    ) {
        // 본인과 대상 사용자 사이에 관계가 없을 때만 REQUESTED row를 생성한다.
        FriendRequestCreateResponse response = friendCommandService.createFriendRequest(principal.userId(), request);
        return ApiResponse.ok(response);
    }

    @PostMapping("/requests/{friendshipId}/accept")
    @Operation(summary = "친구 요청 수락", description = "현재 사용자가 받은 친구 요청을 수락합니다.")
    public ApiResponse<Void> acceptFriendRequest(
            @CurrentUser CustomUserPrincipal principal,
            @PathVariable("friendshipId") java.util.UUID friendshipId
    ) {
        friendCommandService.acceptFriendRequest(principal.userId(), friendshipId);
        return ApiResponse.ok();
    }

    @PostMapping("/requests/{friendshipId}/decline")
    @Operation(summary = "친구 요청 거절", description = "현재 사용자가 받은 친구 요청을 거절합니다.")
    public ApiResponse<Void> declineFriendRequest(
            @CurrentUser CustomUserPrincipal principal,
            @PathVariable("friendshipId") java.util.UUID friendshipId
    ) {
        friendCommandService.declineFriendRequest(principal.userId(), friendshipId);
        return ApiResponse.ok();
    }

    @GetMapping("/requests/received")
    @Operation(summary = "받은 친구 요청 목록 조회", description = "현재 사용자가 받은 친구 요청 목록을 조회합니다.")
    public ApiResponse<FriendRequestListResult> getReceivedFriendRequests(@CurrentUser CustomUserPrincipal principal) {
        List<FriendRequestListItemResponse> response = friendQueryService.getReceivedFriendRequests(principal.userId());
        return ApiResponse.ok(new FriendRequestListResult(response));
    }

    @GetMapping("/requests/sent")
    @Operation(summary = "보낸 친구 요청 목록 조회", description = "현재 사용자가 보낸 친구 요청 목록을 조회합니다.")
    public ApiResponse<FriendRequestListResult> getSentFriendRequests(@CurrentUser CustomUserPrincipal principal) {
        List<FriendRequestListItemResponse> response = friendQueryService.getSentFriendRequests(principal.userId());
        return ApiResponse.ok(new FriendRequestListResult(response));
    }

    @GetMapping("/search")
    @Operation(summary = "친구 검색", description = "닉네임으로 사용자를 검색하고 현재 친구 상태를 함께 반환합니다.")
    public ApiResponse<FriendSearchResult> searchFriends(
            @CurrentUser CustomUserPrincipal principal,
            @RequestParam("keyword") String keyword
    ) {
        // 로그인한 사용자 기준으로 검색 결과의 관계 상태를 함께 내려준다.
        List<FriendSearchResponse> response = friendQueryService.searchFriends(principal.userId(), keyword);
        return ApiResponse.ok(new FriendSearchResult(response));
    }

    @GetMapping
    @Operation(summary = "친구 목록 조회", description = "현재 사용자의 친구 목록을 조회합니다.")
    public ApiResponse<FriendListResult> getFriends(@CurrentUser CustomUserPrincipal principal) {
        // 현재 사용자의 확정된 친구만 조회한다.
        List<FriendListResponse> response = friendQueryService.getFriends(principal.userId());
        return ApiResponse.ok(new FriendListResult(response));
    }
}
