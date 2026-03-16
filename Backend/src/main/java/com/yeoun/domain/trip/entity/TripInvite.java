package com.yeoun.domain.trip.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
@Table(name = "trip_invites")
public class TripInvite {

    @Id
    @Column(name = "trip_invite_id", nullable = false, updatable = false)
    private UUID tripInviteId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "inviter_user_id", nullable = false)
    private UUID inviterUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "invite_type", nullable = false)
    private TripInviteType inviteType;

    @Column(name = "invite_token", nullable = false, unique = true)
    private String inviteToken;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TripInviteStatus status;

    @Column(name = "target_user_id")
    private UUID targetUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "used_at")
    private Instant usedAt;

    public void markExpired() {
        this.status = TripInviteStatus.EXPIRED;
    }

    public void extendExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
        this.status = TripInviteStatus.SENT;
    }
}
