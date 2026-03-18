package com.yeoun.domain.photo.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.photo.dto.request.PhotoSyncRequest;
import com.yeoun.domain.photo.dto.request.PhotoUpdateRequest;
import com.yeoun.domain.photo.dto.response.PhotoDetailResponse;
import com.yeoun.domain.photo.dto.response.PhotoSyncResponse;
import com.yeoun.domain.photo.dto.response.PhotoUpdateResponse;
import com.yeoun.domain.photo.dto.response.TripPhotoListResponse;
import com.yeoun.domain.photo.service.PhotoQueryService;
import com.yeoun.domain.photo.service.PhotoSyncService;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Photo", description = "사진 API")
@SecurityRequirement(name = "bearerAuth")
public class PhotoController {

    private final PhotoQueryService photoQueryService;
    private final PhotoSyncService photoSyncService;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    public PhotoController(
            PhotoQueryService photoQueryService,
            PhotoSyncService photoSyncService,
            ObjectMapper objectMapper,
            Validator validator
    ) {
        this.photoQueryService = photoQueryService;
        this.photoSyncService = photoSyncService;
        this.objectMapper = objectMapper;
        this.validator = validator;
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

    @PostMapping(value = "/trips/{tripId}/photos/sync", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "사진 동기화 실행", description = "여행 사진 메타데이터와 파일을 동기화합니다.")
    public ApiResponse<PhotoSyncResponse> syncPhotos(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId,
            @RequestPart("metadata") String metadataRaw,
            @RequestPart("files") List<MultipartFile> files
    ) {
        PhotoSyncRequest metadata = parseSyncMetadata(metadataRaw);
        PhotoSyncResponse response = photoSyncService.syncTripPhotos(principal.userId(), tripId, metadata, files);
        return ApiResponse.ok(response);
    }

    private PhotoSyncRequest parseSyncMetadata(String metadataRaw) {
        try {
            PhotoSyncRequest metadata = objectMapper.readValue(metadataRaw, PhotoSyncRequest.class);
            var violations = validator.validate(metadata);
            if (!violations.isEmpty()) {
                String message = violations.stream()
                        .map(ConstraintViolation::getMessage)
                        .collect(Collectors.joining(", "));
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, message);
            }
            return metadata;
        } catch (JsonProcessingException ex) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
    }
}
