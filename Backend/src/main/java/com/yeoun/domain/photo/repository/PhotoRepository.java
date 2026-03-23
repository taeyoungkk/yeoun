package com.yeoun.domain.photo.repository;

import com.yeoun.domain.photo.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.time.Instant;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {
    List<Photo> findByTripIdOrderByTakenAtAscCreatedAtAsc(UUID tripId);

    @Query(value = """
            SELECT *
            FROM photos p
            WHERE p.trip_id = :tripId
            ORDER BY COALESCE(p.taken_at, p.created_at) ASC, p.photo_id ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<Photo> findTripPhotosFirstPage(
            @Param("tripId") UUID tripId,
            @Param("limit") int limit
    );

    @Query(value = """
            SELECT *
            FROM photos p
            WHERE p.trip_id = :tripId
              AND (COALESCE(p.taken_at, p.created_at), p.photo_id) > (:cursorSortAt, :cursorPhotoId)
            ORDER BY COALESCE(p.taken_at, p.created_at) ASC, p.photo_id ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<Photo> findTripPhotosNextPage(
            @Param("tripId") UUID tripId,
            @Param("cursorSortAt") Instant cursorSortAt,
            @Param("cursorPhotoId") UUID cursorPhotoId,
            @Param("limit") int limit
    );

    boolean existsByOwnerUserIdAndTripIdAndFileHash(UUID ownerUserId, UUID tripId, String fileHash);
}
