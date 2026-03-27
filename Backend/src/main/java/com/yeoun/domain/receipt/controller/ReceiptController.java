package com.yeoun.domain.receipt.controller;

import com.yeoun.domain.receipt.dto.request.ReceiptOcrCreateRequest;
import com.yeoun.domain.receipt.dto.request.ReceiptOcrSelectRequest;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrCreateResponse;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrResultResponse;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrSelectResponse;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrStatusResponse;
import com.yeoun.domain.receipt.dto.response.ReceiptUploadResponse;
import com.yeoun.domain.receipt.service.ReceiptOcrCommandService;
import com.yeoun.domain.receipt.service.ReceiptOcrQueryService;
import com.yeoun.domain.receipt.service.ReceiptOcrSelectService;
import com.yeoun.domain.receipt.service.ReceiptUploadService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Receipt", description = "영수증 OCR API")
@SecurityRequirement(name = "bearerAuth")
public class ReceiptController {

    private final ReceiptUploadService receiptUploadService;
    private final ReceiptOcrCommandService receiptOcrCommandService;
    private final ReceiptOcrQueryService receiptOcrQueryService;
    private final ReceiptOcrSelectService receiptOcrSelectService;

    public ReceiptController(
            ReceiptUploadService receiptUploadService,
            ReceiptOcrCommandService receiptOcrCommandService,
            ReceiptOcrQueryService receiptOcrQueryService,
            ReceiptOcrSelectService receiptOcrSelectService
    ) {
        this.receiptUploadService = receiptUploadService;
        this.receiptOcrCommandService = receiptOcrCommandService;
        this.receiptOcrQueryService = receiptOcrQueryService;
        this.receiptOcrSelectService = receiptOcrSelectService;
    }

    @PostMapping(value = "/trips/{tripId}/receipts/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "영수증 이미지 업로드", description = "영수증 OCR 요청 전에 이미지를 저장소에 업로드합니다.")
    public ApiResponse<ReceiptUploadResponse> uploadReceipt(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId,
            @RequestPart("file") MultipartFile file
    ) {
        ReceiptUploadResponse response = receiptUploadService.uploadReceipt(principal.userId(), tripId, file);
        return ApiResponse.ok(response);
    }

    @PostMapping("/trips/{tripId}/receipts/ocr-requests")
    @Operation(summary = "영수증 OCR 요청", description = "업로드된 영수증 이미지 URL로 OCR 처리를 요청합니다.")
    public ApiResponse<ReceiptOcrCreateResponse> requestReceiptOcr(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId,
            @Valid @RequestBody ReceiptOcrCreateRequest request
    ) {
        ReceiptOcrCreateResponse response = receiptOcrCommandService.requestReceiptOcr(principal.userId(), tripId, request);
        return ApiResponse.ok(response);
    }

    @GetMapping("/receipts/{receiptId}/ocr-status")
    @Operation(summary = "영수증 OCR 상태 조회", description = "영수증 OCR 처리 상태를 조회합니다.")
    public ApiResponse<ReceiptOcrStatusResponse> getReceiptOcrStatus(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("receiptId") UUID receiptId
    ) {
        ReceiptOcrStatusResponse response = receiptOcrQueryService.getReceiptOcrStatus(principal.userId(), receiptId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/receipts/{receiptId}/ocr-result")
    @Operation(summary = "영수증 OCR 결과 조회", description = "영수증 OCR 결과와 항목 목록을 조회합니다.")
    public ApiResponse<ReceiptOcrResultResponse> getReceiptOcrResult(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("receiptId") UUID receiptId
    ) {
        ReceiptOcrResultResponse response = receiptOcrQueryService.getReceiptOcrResult(principal.userId(), receiptId);
        return ApiResponse.ok(response);
    }

    @PostMapping("/receipts/{receiptId}/select")
    @Operation(summary = "영수증 OCR 결과 선택", description = "처리 완료된 OCR 결과를 비용(정산용)으로 생성하고, 선택한 항목별 참여자를 반영합니다.")
    public ApiResponse<ReceiptOcrSelectResponse> selectReceiptOcr(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("receiptId") UUID receiptId,
            @Valid @RequestBody ReceiptOcrSelectRequest request
    ) {
        ReceiptOcrSelectResponse response = receiptOcrSelectService.selectReceiptOcr(
                principal.userId(),
                receiptId,
                request
        );
        return ApiResponse.ok(response);
    }
}
