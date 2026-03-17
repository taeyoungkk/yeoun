package com.yeoun.domain.photo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "photos")
public class Photo {

    @Id
    @Column(name = "photo_id", nullable = false, updatable = false)
    private UUID photoId;

    @Column(name = "owner_user_id", nullable = false)
    private UUID ownerUserId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "thumbnail_key", length = 500)
    private String thumbnailKey;

    @Column(name = "file_hash", nullable = false, length = 64)
    private String fileHash;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "taken_at")
    private Instant takenAt;

    @Column(name = "taken_timezone", length = 100)
    private String takenTimezone;

    @Column(name = "exif_latitude", precision = 10, scale = 7)
    private BigDecimal exifLatitude;

    @Column(name = "exif_longitude", precision = 10, scale = 7)
    private BigDecimal exifLongitude;

    @Column(name = "metadata_json", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String metadataJson;

    @Column(name = "is_excluded", nullable = false)
    private boolean excluded;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void updateExcluded(boolean excluded, Instant now) {
        this.excluded = excluded;
        this.updatedAt = now;
    }
}
