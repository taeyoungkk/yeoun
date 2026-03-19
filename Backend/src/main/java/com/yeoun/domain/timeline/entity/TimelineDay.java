package com.yeoun.domain.timeline.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "timeline_days")
public class TimelineDay {

    @Id
    @Column(name = "timeline_day_id", nullable = false, updatable = false)
    private UUID timelineDayId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "day_date", nullable = false)
    private LocalDate dayDate;

    @Column(name = "summary_text")
    private String summaryText;

    @Column(name = "distance_m", precision = 12, scale = 2)
    private BigDecimal distanceM;

    @Column(name = "photo_count", nullable = false)
    private int photoCount;

    @Column(name = "event_count", nullable = false)
    private int eventCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void updateSummary(String summaryText, BigDecimal distanceM, int photoCount, int eventCount, Instant now) {
        this.summaryText = summaryText;
        this.distanceM = distanceM;
        this.photoCount = photoCount;
        this.eventCount = eventCount;
        this.updatedAt = now;
    }
}
