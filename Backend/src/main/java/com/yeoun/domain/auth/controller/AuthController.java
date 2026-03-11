package com.yeoun.domain.auth.controller;

import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.request.RefreshTokenRequest;
import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.dto.response.LoginResponse;
import com.yeoun.domain.auth.service.LocalLoginService;
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
@Tag(name = "Auth", description = "Authentication API")
public class AuthController {

    private final LocalLoginService localLoginService;
    private final JwtTokenResolver jwtTokenResolver;

    public AuthController(LocalLoginService localLoginService, JwtTokenResolver jwtTokenResolver) {
        this.localLoginService = localLoginService;
        this.jwtTokenResolver = jwtTokenResolver;
    }

    @PostMapping("/login")
    @Operation(summary = "Login", description = "Log in with email and password.")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = localLoginService.login(request);
        return ApiResponse.ok(response);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh tokens", description = "Reissue access and refresh tokens with a refresh token.")
    public ApiResponse<AuthTokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthTokenResponse response = localLoginService.refresh(request);
        return ApiResponse.ok(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout", description = "Delete the current user's refresh token from Redis.")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<Void> logout(
            @CurrentUser CustomUserPrincipal principal,
            HttpServletRequest request
    ) {
        String accessToken = jwtTokenResolver.resolveAccessToken(request);
        localLoginService.logout(principal.userId(), accessToken);
        return ApiResponse.ok();
    }
}
