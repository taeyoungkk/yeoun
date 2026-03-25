package com.yeoun.domain.sharedalbum.controller;

import com.yeoun.domain.sharedalbum.dto.request.SharedAlbumMemberReplaceRequest;
import com.yeoun.domain.sharedalbum.dto.request.SharedAlbumUpdateRequest;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumCreateResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumMemberListResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumTripResponse;
import com.yeoun.domain.sharedalbum.service.SharedAlbumService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "SharedAlbum", description = "여행 리포트형 공유 앨범 API")
@SecurityRequirement(name = "bearerAuth")
public class SharedAlbumController {

    private final SharedAlbumService sharedAlbumService;

    public SharedAlbumController(SharedAlbumService sharedAlbumService) {
        this.sharedAlbumService = sharedAlbumService;
    }

    @GetMapping("/trips/{tripId}/shared-album")
    @Operation(summary = "공유 앨범 조회", description = "이 여행의 공유 앨범 존재 여부와 첫 화면에 필요한 요약 정보를 조회합니다.")
    public ApiResponse<SharedAlbumTripResponse> getSharedAlbum(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        SharedAlbumTripResponse response = sharedAlbumService.getSharedAlbumByTrip(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @PostMapping("/trips/{tripId}/shared-album")
    @Operation(summary = "공유 앨범 생성", description = "여행 리포트 화면에 사용할 공유 앨범 메타 정보를 생성합니다.")
    public ApiResponse<SharedAlbumCreateResponse> createSharedAlbum(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        SharedAlbumCreateResponse response = sharedAlbumService.createSharedAlbum(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @PatchMapping("/shared-albums/{sharedAlbumId}")
    @Operation(summary = "공유 앨범 수정", description = "공유 앨범 제목, 대표 지역명, 설명, 공개 범위, 커버 사진을 수정합니다.")
    public ApiResponse<SharedAlbumCreateResponse> updateSharedAlbum(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("sharedAlbumId") UUID sharedAlbumId,
            @Valid @RequestBody SharedAlbumUpdateRequest request
    ) {
        SharedAlbumCreateResponse response = sharedAlbumService.updateSharedAlbum(principal.userId(), sharedAlbumId, request);
        return ApiResponse.ok(response);
    }

    @GetMapping("/shared-albums/{sharedAlbumId}/members")
    @Operation(summary = "공유 앨범 멤버 조회", description = "공유 앨범에 접근 가능한 멤버 목록을 조회합니다.")
    public ApiResponse<SharedAlbumMemberListResponse> getSharedAlbumMembers(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("sharedAlbumId") UUID sharedAlbumId
    ) {
        SharedAlbumMemberListResponse response = sharedAlbumService.getSharedAlbumMembers(principal.userId(), sharedAlbumId);
        return ApiResponse.ok(response);
    }

    @PutMapping("/shared-albums/{sharedAlbumId}/members")
    @Operation(summary = "공유 앨범 멤버 전체 설정", description = "공유 앨범에 접근 가능한 멤버 목록을 통째로 저장합니다.")
    public ApiResponse<SharedAlbumMemberListResponse> replaceSharedAlbumMembers(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("sharedAlbumId") UUID sharedAlbumId,
            @Valid @RequestBody SharedAlbumMemberReplaceRequest request
    ) {
        SharedAlbumMemberListResponse response =
                sharedAlbumService.replaceSharedAlbumMembers(principal.userId(), sharedAlbumId, request);
        return ApiResponse.ok(response);
    }
}
