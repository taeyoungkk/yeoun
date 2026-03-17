package com.yeoun.domain.tripprocessing.entity;

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
@Table(name = "trip_processing_statuses")
public class TripProcessingStatus {

    @Id
    @Column(name = "trip_id", nullable = false, updatable = false)
    private UUID tripId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TripProcessingStatusType status;

    @Column(name = "last_requested_at")
    private Instant lastRequestedAt;

    @Column(name = "last_processed_at")
    private Instant lastProcessedAt;

    @Column(name = "last_error_message", length = 500)
    private String lastErrorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void markPending(Instant now) {
        this.status = TripProcessingStatusType.PENDING;
        this.lastRequestedAt = now;
        this.lastErrorMessage = null;
        this.updatedAt = now;
    }

    public void markQueued(Instant now) {
        this.status = TripProcessingStatusType.QUEUED;
        this.lastErrorMessage = null;
        this.updatedAt = now;
    }

    public void markProcessing(Instant now) {
        this.status = TripProcessingStatusType.PROCESSING;
        this.lastErrorMessage = null;
        this.updatedAt = now;
    }

    public void markReady(Instant now) {
        this.status = TripProcessingStatusType.READY;
        this.lastProcessedAt = now;
        this.lastErrorMessage = null;
        this.updatedAt = now;
    }

    public void markFailed(Instant now, String errorMessage) {
        this.status = TripProcessingStatusType.FAILED;
        this.lastErrorMessage = errorMessage;
        this.updatedAt = now;
    }
}
