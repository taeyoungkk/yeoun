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
@Tag(name = "Notification", description = "In-app notification API")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "Get notifications", description = "Returns the in-app notifications for current user.")
    public ApiResponse<NotificationListResponse> getNotifications(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        NotificationListResponse response = notificationService.getNotifications(principal.userId());
        return ApiResponse.ok(response);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Get unread notification count", description = "Returns unread notification count.")
    public ApiResponse<NotificationUnreadCountResponse> getUnreadCount(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        NotificationUnreadCountResponse response = notificationService.getUnreadCount(principal.userId());
        return ApiResponse.ok(response);
    }

    @PatchMapping("/{notificationId}/read")
    @Operation(summary = "Mark notification as read", description = "Marks a specific notification as read.")
    public ApiResponse<NotificationReadResponse> markAsRead(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("notificationId") UUID notificationId
    ) {
        NotificationReadResponse response = notificationService.markAsRead(principal.userId(), notificationId);
        return ApiResponse.ok(response);
    }

    @PatchMapping("/read-all")
    @Operation(summary = "Mark all notifications as read", description = "Marks all unread notifications as read.")
    public ApiResponse<NotificationReadAllResponse> markAllAsRead(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal
    ) {
        NotificationReadAllResponse response = notificationService.markAllAsRead(principal.userId());
        return ApiResponse.ok(response);
    }
}
