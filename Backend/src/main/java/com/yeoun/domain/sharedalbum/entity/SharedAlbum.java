package com.yeoun.domain.sharedalbum.entity;

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
        name = "shared_albums",
        uniqueConstraints = {
                @UniqueConstraint(name = "ux_shared_albums_trip_id", columnNames = "trip_id")
        }
)
public class SharedAlbum {

    @Id
    @Column(name = "shared_album_id", nullable = false, updatable = false)
    private UUID sharedAlbumId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "region_label", length = 100)
    private String regionLabel;

    @Column(name = "description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 20)
    private SharedAlbumVisibility visibility;

    @Column(name = "cover_photo_id")
    private UUID coverPhotoId;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void updateBasicInfo(
            String title,
            String regionLabel,
            String description,
            SharedAlbumVisibility visibility,
            UUID coverPhotoId,
            Instant now
    ) {
        this.title = title;
        this.regionLabel = regionLabel;
        this.description = description;
        this.visibility = visibility;
        this.coverPhotoId = coverPhotoId;
        this.updatedAt = now;
    }
}
