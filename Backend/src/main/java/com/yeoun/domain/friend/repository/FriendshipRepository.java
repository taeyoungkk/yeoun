package com.yeoun.domain.friend.repository;

import com.yeoun.domain.friend.entity.Friendship;
import com.yeoun.domain.friend.entity.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    // 현재 사용자와 검색 결과 사용자들 사이의 관계를 한 번에 조회한다.
    @Query("""
            select f
            from Friendship f
            where ((f.userId = :userId and f.friendUserId in :targetUserIds)
                or (f.friendUserId = :userId and f.userId in :targetUserIds))
            """)
    List<Friendship> findAllRelationships(UUID userId, Collection<UUID> targetUserIds);

    // 친구 목록은 ACCEPTED 상태만 필요하므로 현재 사용자 기준 양방향으로 조회한다.
    @Query("""
            select f
            from Friendship f
            where f.status = :status
              and (f.userId = :userId or f.friendUserId = :userId)
            order by f.updatedAt desc
            """)
    List<Friendship> findAllByUserIdAndStatus(UUID userId, FriendshipStatus status);
}
