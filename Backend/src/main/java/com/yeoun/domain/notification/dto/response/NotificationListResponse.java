package com.yeoun.domain.notification.dto.response;

import java.util.List;

public record NotificationListResponse(
        List<NotificationItemResponse> notifications
) {
}
