package com.yeoun.domain.locationlog.entity;

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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
        name = "location_logs_raw",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_location_logs_raw_trip_user_client_log",
                        columnNames = {"trip_id", "user_id", "client_log_uuid"}
                )
        }
)
public class LocationLogRaw {

    @Id
    @Column(name = "location_log_id", nullable = false, updatable = false)
    private UUID locationLogId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "latitude", nullable = false, precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", nullable = false, precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "accuracy_m", nullable = false, precision = 8, scale = 2)
    private BigDecimal accuracyM;

    @Column(name = "speed_mps", precision = 8, scale = 2)
    private BigDecimal speedMps;

    @Column(name = "heading", precision = 6, scale = 2)
    private BigDecimal heading;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false)
    private LocationLogSource source;

    @Column(name = "client_log_uuid", nullable = false, length = 100)
    private String clientLogUuid;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
