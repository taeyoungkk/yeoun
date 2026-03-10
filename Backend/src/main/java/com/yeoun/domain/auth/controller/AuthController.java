package com.yeoun.domain.auth.controller;

import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.response.LoginResponse;
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

    public AuthController(LocalLoginService localLoginService) {
        this.localLoginService = localLoginService;
    }

    @PostMapping("/login")
    @Operation(summary = "로그인", description = "이메일과 비밀번호로 로그인합니다.")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = localLoginService.login(request);
        return ApiResponse.ok(response);
    }
}
