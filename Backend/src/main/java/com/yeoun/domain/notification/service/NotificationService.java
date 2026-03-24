package com.yeoun.domain.notification.service;

import com.yeoun.domain.notification.dto.response.NotificationItemResponse;
import com.yeoun.domain.notification.dto.response.NotificationListResponse;
import com.yeoun.domain.notification.dto.response.NotificationReadAllResponse;
import com.yeoun.domain.notification.dto.response.NotificationReadResponse;
import com.yeoun.domain.notification.dto.response.NotificationUnreadCountResponse;
import com.yeoun.domain.notification.entity.Notification;
import com.yeoun.domain.notification.entity.NotificationType;
import com.yeoun.domain.notification.repository.NotificationRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public NotificationListResponse getNotifications(UUID userId) {
        List<NotificationItemResponse> items = notificationRepository.findAllByReceiverUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toItemResponse)
                .toList();
        return new NotificationListResponse(items);
    }

    public NotificationUnreadCountResponse getUnreadCount(UUID userId) {
        long unreadCount = notificationRepository.countByReceiverUserIdAndReadFalse(userId);
        return new NotificationUnreadCountResponse(unreadCount);
    }

    @Transactional
    public NotificationReadResponse markAsRead(UUID userId, UUID notificationId) {
        Notification notification = notificationRepository.findByNotificationIdAndReceiverUserId(notificationId, userId)
                .orElseThrow(() -> new BaseException(ErrorCode.NOTIFICATION_NOT_FOUND));
        notification.markRead(Instant.now());
        return new NotificationReadResponse(notification.getNotificationId(), notification.isRead());
    }

    @Transactional
    public NotificationReadAllResponse markAllAsRead(UUID userId) {
        Instant now = Instant.now();
        List<Notification> unreadNotifications = notificationRepository.findAllByReceiverUserIdAndReadFalse(userId);
        unreadNotifications.forEach(notification -> notification.markRead(now));
        return new NotificationReadAllResponse(unreadNotifications.size());
    }

    @Transactional
    public void createNotification(
            UUID receiverUserId,
            UUID actorUserId,
            UUID tripId,
            UUID resourceId,
            NotificationType type,
            String title,
            String body
    ) {
        Notification notification = Notification.builder()
                .notificationId(UUID.randomUUID())
                .receiverUserId(receiverUserId)
                .actorUserId(actorUserId)
                .tripId(tripId)
                .resourceId(resourceId)
                .type(type)
                .title(title)
                .body(body)
                .read(false)
                .createdAt(Instant.now())
                .readAt(null)
                .build();
        notificationRepository.save(notification);
    }

    private NotificationItemResponse toItemResponse(Notification notification) {
        return new NotificationItemResponse(
                notification.getNotificationId(),
                notification.getType(),
                notification.getTitle(),
                notification.getBody(),
                notification.isRead(),
                notification.getCreatedAt(),
                notification.getReadAt(),
                notification.getActorUserId(),
                notification.getTripId(),
                notification.getResourceId()
        );
    }
}
