package com.yeoun.domain.locationlog.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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
@Table(
        name = "location_route_days",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_location_route_days_trip_user_day",
                        columnNames = {"trip_id", "user_id", "day"}
                )
        }
)
public class LocationRouteDay {

    @Id
    @Column(name = "route_day_id", nullable = false, updatable = false)
    private UUID routeDayId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "day", nullable = false)
    private LocalDate day;

    @Column(name = "point_count", nullable = false)
    private int pointCount;

    @Column(name = "distance_m", nullable = false, precision = 12, scale = 2)
    private BigDecimal distanceM;

    @Column(name = "coordinates_json", nullable = false, columnDefinition = "jsonb")
    private String coordinatesJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
