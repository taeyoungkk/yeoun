package com.yeoun.domain.friend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
        name = "friendships",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_friendships_user_id_friend_user_id",
                        columnNames = {"user_id", "friend_user_id"}
                )
        }
)
public class Friendship {

    @Id
    @Column(name = "friendship_id", nullable = false, updatable = false)
    private UUID friendshipId;

    // 친구 요청을 먼저 보낸 사용자
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    // 요청을 받은 상대 사용자
    @Column(name = "friend_user_id", nullable = false)
    private UUID friendUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private FriendshipStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
