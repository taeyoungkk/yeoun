package com.yeoun.domain.sharedalbum.entity;

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

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
        name = "shared_album_event_selections",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_shared_album_event_selections_shared_album_event",
                        columnNames = {"shared_album_id", "event_id"}
                )
        }
)
public class SharedAlbumEventSelection {

    @Id
    @Column(name = "shared_album_event_selection_id", nullable = false, updatable = false)
    private UUID sharedAlbumEventSelectionId;

    @Column(name = "shared_album_id", nullable = false)
    private UUID sharedAlbumId;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
