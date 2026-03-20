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

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "event_photos")
public class EventPhoto {

    @Id
    @Column(name = "event_photo_id", nullable = false, updatable = false)
    private UUID eventPhotoId;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "photo_id", nullable = false)
    private UUID photoId;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "is_representative", nullable = false)
    private boolean representative;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
