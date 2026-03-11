package com.yeoun.domain.auth.controller;

import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.request.SendEmailCodeRequest;
import com.yeoun.domain.auth.dto.request.VerifyEmailCodeRequest;
import com.yeoun.domain.auth.dto.response.EmailCodeSendResponse;
import com.yeoun.domain.auth.dto.response.EmailVerificationResponse;
import com.yeoun.domain.auth.dto.response.LoginResponse;
import com.yeoun.domain.auth.service.EmailVerificationService;
import com.yeoun.domain.auth.service.LocalLoginService;
import com.yeoun.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "인증", description = "로그인/회원가입 등 인증 API")
public class AuthController {

    private final LocalLoginService localLoginService;
    private final EmailVerificationService emailVerificationService;

    public AuthController(
            LocalLoginService localLoginService,
            EmailVerificationService emailVerificationService
    ) {
        this.localLoginService = localLoginService;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/login")
    @Operation(summary = "로그인", description = "이메일과 비밀번호로 로그인합니다.")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = localLoginService.login(request);
        return ApiResponse.ok(response);
    }

    @PostMapping("/email/code")
    @Operation(summary = "이메일 인증코드 발송", description = "입력한 이메일로 6자리 인증코드를 발송합니다.")
    public ApiResponse<EmailCodeSendResponse> sendEmailCode(@Valid @RequestBody SendEmailCodeRequest request) {
        EmailCodeSendResponse response = emailVerificationService.sendCode(request.email());
        return ApiResponse.ok(response);
    }

    @PostMapping("/email/verify")
    @Operation(summary = "이메일 인증코드 검증", description = "이메일과 6자리 인증코드를 검증해 인증 완료 상태를 저장합니다.")
    public ApiResponse<EmailVerificationResponse> verifyEmailCode(@Valid @RequestBody VerifyEmailCodeRequest request) {
        EmailVerificationResponse response = emailVerificationService.verifyCode(request.email(), request.code());
        return ApiResponse.ok(response);
    }
}
