package com.yeoun.domain.user.repository;

import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByNickname(String nickname);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    // 본인을 제외하고 ACTIVE 사용자만 닉네임 부분 일치로 검색한다.
    @Query("""
            select u
            from User u
            where u.userId <> :currentUserId
              and u.status = :status
              and lower(u.nickname) like lower(concat('%', :keyword, '%'))
            order by u.nickname asc
            """)
    List<User> searchActiveUsersByNickname(UUID currentUserId, String keyword, UserStatus status);

    default List<User> searchActiveUsersByNickname(UUID currentUserId, String keyword) {
        return searchActiveUsersByNickname(currentUserId, keyword, UserStatus.ACTIVE);
    }
}
