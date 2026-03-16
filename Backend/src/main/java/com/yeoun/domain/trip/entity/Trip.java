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
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @Column(name = "trip_id", nullable = false, updatable = false)
    private UUID tripId;

    @Column(name = "owner_user_id", nullable = false)
    private UUID ownerUserId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "actual_ended_at")
    private Instant actualEndedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TripStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false)
    @Builder.Default
    private TripVisibility visibility = TripVisibility.PRIVATE;

    @Enumerated(EnumType.STRING)
    @Column(name = "report_status", nullable = false)
    @Builder.Default
    private TripReportStatus reportStatus = TripReportStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public void updateBasicInfo(String title, LocalDate startDate, LocalDate endDate, TripVisibility visibility, Instant now) {
        this.title = title;
        this.startDate = startDate;
        this.endDate = endDate;
        this.visibility = visibility;
        this.updatedAt = now;
    }

    public void markDeleted(Instant now) {
        this.status = TripStatus.DELETED;
        this.deletedAt = now;
        this.updatedAt = now;
    }

    public void markStarted(Instant now) {
        this.status = TripStatus.ACTIVE;
        if (this.startedAt == null) {
            this.startedAt = now;
        }
        this.updatedAt = now;
    }

    public void markEnded(Instant now) {
        this.status = TripStatus.ENDED;
        this.actualEndedAt = now;
        this.updatedAt = now;
    }
}
