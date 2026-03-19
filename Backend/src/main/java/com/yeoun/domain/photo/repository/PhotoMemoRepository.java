package com.yeoun.domain.photo.repository;

import com.yeoun.domain.photo.entity.PhotoMemo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PhotoMemoRepository extends JpaRepository<PhotoMemo, UUID> {

    Optional<PhotoMemo> findByPhotoIdAndUserId(UUID photoId, UUID userId);

    long deleteByPhotoIdAndUserId(UUID photoId, UUID userId);
}
