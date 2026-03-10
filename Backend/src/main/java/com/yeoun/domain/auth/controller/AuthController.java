package com.yeoun.domain.auth.controller;

import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.response.LoginResponse;
import com.yeoun.domain.auth.service.LocalLoginService;
import com.yeoun.global.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final LocalLoginService localLoginService;

    public AuthController(LocalLoginService localLoginService) {
        this.localLoginService = localLoginService;
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = localLoginService.login(request);
        return ApiResponse.ok(response);
    }
}
