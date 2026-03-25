package com.yeoun.domain.sharedalbum.repository;

import com.yeoun.domain.sharedalbum.entity.SharedAlbumEventSelection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SharedAlbumEventSelectionRepository extends JpaRepository<SharedAlbumEventSelection, UUID> {
    List<SharedAlbumEventSelection> findBySharedAlbumIdOrderByDisplayOrderAsc(UUID sharedAlbumId);

    boolean existsBySharedAlbumId(UUID sharedAlbumId);

    void deleteBySharedAlbumId(UUID sharedAlbumId);
}
