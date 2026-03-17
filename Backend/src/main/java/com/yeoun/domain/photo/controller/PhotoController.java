package com.yeoun.domain.photo.controller;

import com.yeoun.domain.photo.dto.request.PhotoUpdateRequest;
import com.yeoun.domain.photo.dto.response.PhotoDetailResponse;
import com.yeoun.domain.photo.dto.response.PhotoUpdateResponse;
import com.yeoun.domain.photo.dto.response.TripPhotoListResponse;
import com.yeoun.domain.photo.service.PhotoQueryService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Photo", description = "사진 API")
@SecurityRequirement(name = "bearerAuth")
public class PhotoController {

    private final PhotoQueryService photoQueryService;

    public PhotoController(PhotoQueryService photoQueryService) {
        this.photoQueryService = photoQueryService;
    }

    @GetMapping("/trips/{tripId}/photos")
    @Operation(summary = "여행 사진 목록 조회", description = "여행에 연결된 사진 목록을 조회합니다.")
    public ApiResponse<TripPhotoListResponse> getTripPhotos(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        TripPhotoListResponse response = photoQueryService.getTripPhotos(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/photos/{photoId}")
    @Operation(summary = "사진 상세 조회", description = "사진 한 장의 상세 정보를 조회합니다.")
    public ApiResponse<PhotoDetailResponse> getPhotoDetail(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("photoId") UUID photoId
    ) {
        PhotoDetailResponse response = photoQueryService.getPhotoDetail(principal.userId(), photoId);
        return ApiResponse.ok(response);
    }

    @PatchMapping("/photos/{photoId}")
    @Operation(summary = "사진 수정", description = "여행 기록에서 사진 제외/복원 상태를 변경합니다.")
    public ApiResponse<PhotoUpdateResponse> updatePhoto(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("photoId") UUID photoId,
            @Valid @RequestBody PhotoUpdateRequest request
    ) {
        PhotoUpdateResponse response = photoQueryService.updatePhoto(principal.userId(), photoId, request);
        return ApiResponse.ok(response);
    }
}
