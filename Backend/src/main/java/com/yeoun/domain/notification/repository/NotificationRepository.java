package com.yeoun.domain.notification.repository;

import com.yeoun.domain.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findAllByReceiverUserIdOrderByCreatedAtDesc(UUID receiverUserId);

    long countByReceiverUserIdAndReadFalse(UUID receiverUserId);

    Optional<Notification> findByNotificationIdAndReceiverUserId(UUID notificationId, UUID receiverUserId);

    List<Notification> findAllByReceiverUserIdAndReadFalse(UUID receiverUserId);
}
