package com.yeoun.domain.notification.controller;

import com.yeoun.domain.notification.dto.response.NotificationListResponse;
import com.yeoun.domain.notification.dto.response.NotificationReadAllResponse;
import com.yeoun.domain.notification.dto.response.NotificationReadResponse;
import com.yeoun.domain.notification.dto.response.NotificationUnreadCountResponse;
import com.yeoun.domain.notification.service.NotificationService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "알림", description = "인앱 알림 API")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "알림 목록 조회", description = "현재 로그인한 사용자의 인앱 알림 목록을 조회합니다.")
    public ApiResponse<NotificationListResponse> getNotifications(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        NotificationListResponse response = notificationService.getNotifications(principal.userId());
        return ApiResponse.ok(response);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "안 읽은 알림 수 조회", description = "현재 로그인한 사용자의 안 읽은 알림 개수를 조회합니다.")
    public ApiResponse<NotificationUnreadCountResponse> getUnreadCount(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        NotificationUnreadCountResponse response = notificationService.getUnreadCount(principal.userId());
        return ApiResponse.ok(response);
    }

    @PatchMapping("/{notificationId}/read")
    @Operation(summary = "알림 읽음 처리", description = "특정 알림 1건을 읽음 상태로 변경합니다.")
    public ApiResponse<NotificationReadResponse> markAsRead(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("notificationId") UUID notificationId
    ) {
        NotificationReadResponse response = notificationService.markAsRead(principal.userId(), notificationId);
        return ApiResponse.ok(response);
    }

    @PatchMapping("/read-all")
    @Operation(summary = "전체 읽음 처리", description = "현재 로그인한 사용자의 안 읽은 알림을 모두 읽음 상태로 변경합니다.")
    public ApiResponse<NotificationReadAllResponse> markAllAsRead(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        NotificationReadAllResponse response = notificationService.markAllAsRead(principal.userId());
        return ApiResponse.ok(response);
    }
}
