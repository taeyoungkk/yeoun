package com.yeoun.domain.sharedalbum.repository;

import com.yeoun.domain.sharedalbum.entity.SharedAlbum;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SharedAlbumRepository extends JpaRepository<SharedAlbum, UUID> {
    Optional<SharedAlbum> findByTripId(UUID tripId);
}
