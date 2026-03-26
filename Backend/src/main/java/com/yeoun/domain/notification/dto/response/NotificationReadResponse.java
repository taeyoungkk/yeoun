package com.yeoun.domain.notification.dto.response;

import java.util.UUID;

public record NotificationReadResponse(
        UUID notificationId,
        boolean read
) {
}
