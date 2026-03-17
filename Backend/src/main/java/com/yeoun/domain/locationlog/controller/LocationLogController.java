package com.yeoun.domain.locationlog.controller;

import com.yeoun.domain.locationlog.dto.request.LocationLogBatchUploadRequest;
import com.yeoun.domain.locationlog.dto.response.LocationLogBatchUploadResponse;
import com.yeoun.domain.locationlog.service.LocationLogService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/location-logs")
@Tag(name = "LocationLog", description = "위치 로그 API")
@SecurityRequirement(name = "bearerAuth")
public class LocationLogController {

    private final LocationLogService locationLogService;

    public LocationLogController(LocationLogService locationLogService) {
        this.locationLogService = locationLogService;
    }

    @PostMapping(":batch")
    @Operation(summary = "위치 로그 일괄 업로드", description = "위치 로그를 한 번에 업로드합니다.")
    public ApiResponse<LocationLogBatchUploadResponse> uploadBatch(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId,
            @Valid @RequestBody LocationLogBatchUploadRequest request
    ) {
        // 실제 업로드 규칙과 저장 로직은 서비스 계층에서 처리한다.
        LocationLogBatchUploadResponse response = locationLogService.uploadBatch(principal.userId(), tripId, request);
        return ApiResponse.ok(response);
    }
}
