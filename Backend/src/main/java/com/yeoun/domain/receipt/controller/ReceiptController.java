package com.yeoun.domain.receipt.controller;

import com.yeoun.domain.receipt.dto.response.ReceiptUploadResponse;
import com.yeoun.domain.receipt.service.ReceiptUploadService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

    public ReceiptController(ReceiptUploadService receiptUploadService) {
        this.receiptUploadService = receiptUploadService;
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
}
