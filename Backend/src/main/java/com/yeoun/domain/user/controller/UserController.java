package com.yeoun.domain.user.controller;

import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.user.dto.request.ChangePasswordRequest;
import com.yeoun.domain.user.dto.request.UpdateMeRequest;
import com.yeoun.domain.user.dto.response.AvailabilityCheckResponse;
import com.yeoun.domain.user.dto.response.MeResponse;
import com.yeoun.domain.user.service.UserProfileService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.jwt.JwtTokenResolver;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User", description = "사용자 프로필 API")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserProfileService userProfileService;
    private final JwtTokenResolver jwtTokenResolver;

    public UserController(UserProfileService userProfileService, JwtTokenResolver jwtTokenResolver) {
        this.userProfileService = userProfileService;
        this.jwtTokenResolver = jwtTokenResolver;
    }

    @GetMapping("/check-nickname")
    @Operation(summary = "닉네임 중복 확인", description = "입력한 닉네임을 사용할 수 있는지 확인합니다.")
    public ApiResponse<AvailabilityCheckResponse> checkNicknameAvailability(
            @RequestParam("nickname") String nickname
    ) {
        AvailabilityCheckResponse response = userProfileService.checkNicknameAvailability(nickname);
        return ApiResponse.ok(response);
    }

    @GetMapping("/check-email")
    @Operation(summary = "이메일 중복 확인", description = "입력한 이메일을 사용할 수 있는지 확인합니다.")
    public ApiResponse<AvailabilityCheckResponse> checkEmailAvailability(
            @RequestParam("email") String email
    ) {
        AvailabilityCheckResponse response = userProfileService.checkEmailAvailability(email);
        return ApiResponse.ok(response);
    }

    @GetMapping("/me")
    @Operation(summary = "내 정보 조회", description = "현재 로그인한 사용자의 프로필 정보를 조회합니다.")
    public ApiResponse<MeResponse> getMe(@Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal) {
        MeResponse response = userProfileService.getMe(principal.userId());
        return ApiResponse.ok(response);
    }

    @PatchMapping("/me")
    @Operation(summary = "내 정보 수정", description = "현재 로그인한 사용자의 닉네임을 수정합니다.")
    public ApiResponse<MeResponse> updateMe(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @Valid @RequestBody UpdateMeRequest request
    ) {
        MeResponse response = userProfileService.updateMe(principal.userId(), request);
        return ApiResponse.ok(response);
    }

    @PostMapping(value = "/me/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "프로필 이미지 업로드", description = "현재 로그인한 사용자의 프로필 이미지를 업로드합니다.")
    public ApiResponse<MeResponse> uploadProfileImage(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @RequestPart("file") MultipartFile file
    ) {
        MeResponse response = userProfileService.uploadProfileImage(principal.userId(), file);
        return ApiResponse.ok(response);
    }

    @DeleteMapping("/me")
    @Operation(summary = "회원 탈퇴", description = "현재 로그인한 사용자의 계정을 탈퇴 처리합니다.")
    public ApiResponse<Void> withdrawMe(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            HttpServletRequest request
    ) {
        String accessToken = jwtTokenResolver.resolveAccessToken(request);
        userProfileService.withdrawMe(principal.userId(), accessToken);
        return ApiResponse.ok();
    }

    @PatchMapping("/me/password")
    @Operation(summary = "비밀번호 변경", description = "현재 로그인한 사용자의 비밀번호를 변경합니다.")
    public ApiResponse<AuthTokenResponse> changePassword(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest changePasswordRequest
    ) {
        AuthTokenResponse response = userProfileService.changePassword(principal.userId(), changePasswordRequest);
        return ApiResponse.ok(response);
    }
}
