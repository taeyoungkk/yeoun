package com.yeoun.domain.timeline.entity;

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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "events")
public class Event {

    @Id
    @Column(name = "event_id", nullable = false, updatable = false)
    private UUID eventId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "timeline_day_id", nullable = false)
    private UUID timelineDayId;

    @Enumerated(EnumType.STRING)
    @Column(name = "created_by", nullable = false, length = 20)
    private EventCreatedBy createdBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 20)
    private EventType eventType;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "place_name", length = 255)
    private String placeName;

    @Column(name = "place_external_id", length = 255)
    private String placeExternalId;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "center_latitude", precision = 10, scale = 7)
    private BigDecimal centerLatitude;

    @Column(name = "center_longitude", precision = 10, scale = 7)
    private BigDecimal centerLongitude;

    @Column(name = "radius_m", precision = 12, scale = 2)
    private BigDecimal radiusM;

    @Column(name = "is_hidden", nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void updateBasicInfo(
            String title,
            String placeName,
            String placeExternalId,
            Instant startAt,
            Instant endAt,
            BigDecimal centerLatitude,
            BigDecimal centerLongitude,
            BigDecimal radiusM,
            boolean hidden,
            Instant now
    ) {
        this.title = title;
        this.placeName = placeName;
        this.placeExternalId = placeExternalId;
        this.startAt = startAt;
        this.endAt = endAt;
        this.centerLatitude = centerLatitude;
        this.centerLongitude = centerLongitude;
        this.radiusM = radiusM;
        this.hidden = hidden;
        this.updatedAt = now;
    }
}
