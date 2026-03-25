package com.yeoun.domain.sharedalbum.repository;

import com.yeoun.domain.sharedalbum.entity.SharedAlbumMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SharedAlbumMemberRepository extends JpaRepository<SharedAlbumMember, UUID> {
    List<SharedAlbumMember> findBySharedAlbumIdOrderByCreatedAtAsc(UUID sharedAlbumId);

    void deleteBySharedAlbumId(UUID sharedAlbumId);
}
