package com.yeoun.domain.auth.controller;

import com.yeoun.domain.auth.dto.request.GoogleLoginRequest;
import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.request.RefreshTokenRequest;
import com.yeoun.domain.auth.dto.request.SendEmailCodeRequest;
import com.yeoun.domain.auth.dto.request.VerifyEmailCodeRequest;
import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.dto.response.EmailCodeSendResponse;
import com.yeoun.domain.auth.dto.response.EmailVerificationResponse;
import com.yeoun.domain.auth.dto.response.LoginResponse;
import com.yeoun.domain.auth.service.EmailVerificationService;
import com.yeoun.domain.auth.service.LocalLoginService;
import com.yeoun.domain.auth.service.OAuthService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.jwt.JwtTokenResolver;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth", description = "인증 API")
public class AuthController {

    private final LocalLoginService localLoginService;
    private final OAuthService oAuthService;
    private final JwtTokenResolver jwtTokenResolver;
    private final EmailVerificationService emailVerificationService;

    public AuthController(
            LocalLoginService localLoginService,
            OAuthService oAuthService,
            EmailVerificationService emailVerificationService,
            JwtTokenResolver jwtTokenResolver
    ) {
        this.localLoginService = localLoginService;
        this.oAuthService = oAuthService;
        this.emailVerificationService = emailVerificationService;
        this.jwtTokenResolver = jwtTokenResolver;
    }

    @PostMapping("/login")
    @Operation(summary = "로그인", description = "이메일과 비밀번호로 로그인합니다.")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = localLoginService.login(request);
        return ApiResponse.ok(response);
    }

    @PostMapping("/oauth/google")
    @Operation(
            summary = "구글 OAuth 로그인",
            description = "구글 계정으로 로그인하며, 신규 사용자는 자동가입 처리됩니다."
    )
    public ApiResponse<AuthTokenResponse> loginWithGoogle(@Valid @RequestBody GoogleLoginRequest request) {
        AuthTokenResponse response = oAuthService.loginWithGoogle(request.idToken());
        return ApiResponse.ok(response);
    }

    @PostMapping("/refresh")
    @Operation(summary = "토큰 재발급", description = "리프레시 토큰으로 액세스/리프레시 토큰을 재발급합니다.")
    public ApiResponse<AuthTokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthTokenResponse response = localLoginService.refresh(request);
        return ApiResponse.ok(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "현재 사용자의 리프레시 토큰을 Redis에서 삭제합니다.")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<Void> logout(
            @CurrentUser CustomUserPrincipal principal,
            HttpServletRequest request
    ) {
        String accessToken = jwtTokenResolver.resolveAccessToken(request);
        localLoginService.logout(principal.userId(), accessToken);
        return ApiResponse.ok();
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
