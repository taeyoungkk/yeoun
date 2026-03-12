package com.yeoun.domain.friend.controller;

import com.yeoun.domain.friend.dto.request.FriendRequestCreateRequest;
import com.yeoun.domain.friend.dto.response.FriendListResponse;
import com.yeoun.domain.friend.dto.response.FriendListResult;
import com.yeoun.domain.friend.dto.response.FriendRequestCreateResponse;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/friends")
@Tag(name = "Friend", description = "Friend query API")
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
    @Operation(summary = "Send friend request", description = "Send a friend request to another user.")
    public ApiResponse<FriendRequestCreateResponse> createFriendRequest(
            @CurrentUser CustomUserPrincipal principal,
            @Valid @RequestBody FriendRequestCreateRequest request
    ) {
        // 본인과 대상 사용자 사이에 관계가 없을 때만 REQUESTED row를 생성한다.
        FriendRequestCreateResponse response = friendCommandService.createFriendRequest(principal.userId(), request);
        return ApiResponse.ok(response);
    }

    @GetMapping("/search")
    @Operation(summary = "Search users", description = "Search users by nickname and include relationship status.")
    public ApiResponse<FriendSearchResult> searchFriends(
            @CurrentUser CustomUserPrincipal principal,
            @RequestParam("keyword") String keyword
    ) {
        // 로그인한 사용자 기준으로 검색 결과의 관계 상태를 함께 내려준다.
        List<FriendSearchResponse> response = friendQueryService.searchFriends(principal.userId(), keyword);
        return ApiResponse.ok(new FriendSearchResult(response));
    }

    @GetMapping
    @Operation(summary = "Get friend list", description = "Return accepted friends for the current user.")
    public ApiResponse<FriendListResult> getFriends(@CurrentUser CustomUserPrincipal principal) {
        // 현재 사용자의 확정된 친구만 조회한다.
        List<FriendListResponse> response = friendQueryService.getFriends(principal.userId());
        return ApiResponse.ok(new FriendListResult(response));
    }
}
