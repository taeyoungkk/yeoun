package com.yeoun.domain.notification.dto.response;

import com.yeoun.domain.notification.entity.NotificationType;

import java.time.Instant;
import java.util.UUID;

public record NotificationItemResponse(
        UUID notificationId,
        NotificationType type,
        String title,
        String body,
        boolean isRead,
        Instant createdAt,
        Instant readAt,
        UUID actorUserId,
        UUID tripId,
        UUID resourceId
) {
}
