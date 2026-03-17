package com.yeoun.domain.photo.repository;

import com.yeoun.domain.photo.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {
    List<Photo> findByTripIdOrderByTakenAtAscCreatedAtAsc(UUID tripId);
}
