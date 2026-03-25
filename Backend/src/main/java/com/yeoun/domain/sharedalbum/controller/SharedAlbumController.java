package com.yeoun.domain.sharedalbum.controller;

import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumCreateResponse;
import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumTripResponse;
import com.yeoun.domain.sharedalbum.service.SharedAlbumService;
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
}
