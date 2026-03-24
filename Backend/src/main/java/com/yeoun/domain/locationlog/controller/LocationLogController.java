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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/location-logs")
@Tag(name = "LocationLog", description = "위치 로그 수집 API")
@SecurityRequirement(name = "bearerAuth")
public class LocationLogController {

    private static final Logger log = LoggerFactory.getLogger(LocationLogController.class);

    private final LocationLogService locationLogService;

    public LocationLogController(LocationLogService locationLogService) {
        this.locationLogService = locationLogService;
    }

    @PostMapping(":batch")
    @Operation(summary = "위치 로그 수집 요청", description = "위치 로그 batch를 Kafka 수집 파이프라인에 접수합니다.")
    public ApiResponse<LocationLogBatchUploadResponse> ingestBatch(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId,
            @Valid @RequestBody LocationLogBatchUploadRequest request
    ) {
        // 수집 요청 검증과 Kafka 발행은 서비스 계층에서 처리한다.
        log.info(
                "위치 로그 업로드 요청 수신. tripId={} requesterUserId={} logCount={}",
                tripId,
                principal.userId(),
                request.logs().size()
        );
        LocationLogBatchUploadResponse response = locationLogService.uploadBatch(principal.userId(), tripId, request);
        return ApiResponse.ok(response);
    }
}
