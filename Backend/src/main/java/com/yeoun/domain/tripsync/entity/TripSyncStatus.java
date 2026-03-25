package com.yeoun.domain.tripsync.entity;

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
@Table(name = "trip_sync_statuses")
public class TripSyncStatus {

    @Id
    @Column(name = "trip_id", nullable = false, updatable = false)
    private UUID tripId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sync_status", nullable = false)
    private SyncStatus syncStatus;

    @Column(name = "route_version", nullable = false)
    private long routeVersion;

    @Column(name = "timeline_version", nullable = false)
    private long timelineVersion;

    @Column(name = "photo_version", nullable = false)
    private long photoVersion;

    @Column(name = "last_error_message", length = 500)
    private String lastErrorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void markProcessing(Instant now) {
        this.syncStatus = SyncStatus.PROCESSING;
        this.lastErrorMessage = null;
        this.updatedAt = now;
    }

    public void markCompleted(Instant now) {
        this.syncStatus = SyncStatus.COMPLETED;
        this.lastErrorMessage = null;
        this.updatedAt = now;
    }

    public void markFailed(Instant now, String errorMessage) {
        this.syncStatus = SyncStatus.FAILED;
        this.lastErrorMessage = errorMessage;
        this.updatedAt = now;
    }

    public void increaseRouteVersion(Instant now) {
        this.routeVersion += 1;
        this.updatedAt = now;
    }

    public void increaseTimelineVersion(Instant now) {
        this.timelineVersion += 1;
        this.updatedAt = now;
    }

    public void increasePhotoVersion(Instant now) {
        this.photoVersion += 1;
        this.updatedAt = now;
    }
}
