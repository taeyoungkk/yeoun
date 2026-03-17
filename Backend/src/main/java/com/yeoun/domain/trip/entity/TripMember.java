package com.yeoun.domain.trip.entity;

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
        name = "trip_members",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_trip_members_trip_id_user_id",
                        columnNames = {"trip_id", "user_id"}
                )
        }
)
public class TripMember {

    @Id
    @Column(name = "trip_member_id", nullable = false, updatable = false)
    private UUID tripMemberId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "invite_status", nullable = false)
    private TripMemberInviteStatus inviteStatus;

    @Column(name = "invited_by_user_id")
    private UUID invitedByUserId;

    @Column(name = "invited_at")
    private Instant invitedAt;

    @Column(name = "joined_at")
    private Instant joinedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_photo_synced_at")
    private Instant lastPhotoSyncedAt;

    public void accept(Instant now, UUID invitedByUserId) {
        this.inviteStatus = TripMemberInviteStatus.ACCEPTED;
        if (this.invitedByUserId == null) {
            this.invitedByUserId = invitedByUserId;
        }
        if (this.invitedAt == null) {
            this.invitedAt = now;
        }
        this.joinedAt = now;
        this.leftAt = null;
    }

    public void leave(Instant now) {
        this.leftAt = now;
    }

    public void markPhotoSynced(Instant now) {
        this.lastPhotoSyncedAt = now;
    }
}
