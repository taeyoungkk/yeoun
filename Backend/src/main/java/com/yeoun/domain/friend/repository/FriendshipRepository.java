package com.yeoun.domain.friend.repository;

import com.yeoun.domain.friend.entity.Friendship;
import com.yeoun.domain.friend.entity.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
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

    // 두 사용자 사이에 기존 관계가 있는지 방향 상관없이 찾는다.
    @Query("""
            select f
            from Friendship f
            where (f.userId = :userId and f.friendUserId = :friendUserId)
               or (f.userId = :friendUserId and f.friendUserId = :userId)
            """)
    Optional<Friendship> findRelationship(UUID userId, UUID friendUserId);

    // 친구 목록은 ACCEPTED 상태만 필요하므로 현재 사용자 기준 양방향으로 조회한다.
    @Query("""
            select f
            from Friendship f
            where f.status = :status
              and (f.userId = :userId or f.friendUserId = :userId)
            order by f.updatedAt desc
            """)
    List<Friendship> findAllByUserIdAndStatus(UUID userId, FriendshipStatus status);

    // 내가 받은 친구 요청은 상대가 보냈고 내가 받은 REQUESTED row들이다.
    @Query("""
            select f
            from Friendship f
            where f.friendUserId = :userId
              and f.status = :status
            order by f.updatedAt desc
            """)
    List<Friendship> findAllReceivedRequests(UUID userId, FriendshipStatus status);

    // 내가 보낸 친구 요청은 내가 보낸 REQUESTED row들이다.
    @Query("""
            select f
            from Friendship f
            where f.userId = :userId
              and f.status = :status
            order by f.updatedAt desc
            """)
    List<Friendship> findAllSentRequests(UUID userId, FriendshipStatus status);
}
