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
        name = "shared_album_members",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_shared_album_members_shared_album_user",
                        columnNames = {"shared_album_id", "user_id"}
                )
        }
)
public class SharedAlbumMember {

    @Id
    @Column(name = "shared_album_member_id", nullable = false, updatable = false)
    private UUID sharedAlbumMemberId;

    @Column(name = "shared_album_id", nullable = false)
    private UUID sharedAlbumId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
