package com.yeoun.domain.user.repository;

import com.yeoun.domain.user.entity.AuthProvider;
import com.yeoun.domain.user.entity.UserAuthAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserAuthAccountRepository extends JpaRepository<UserAuthAccount, UUID> {

    Optional<UserAuthAccount> findByProviderAndProviderUserId(AuthProvider provider, String providerUserId);

    Optional<UserAuthAccount> findByProviderAndLoginEmail(AuthProvider provider, String loginEmail);

    Optional<UserAuthAccount> findByUserUserIdAndProvider(UUID userId, AuthProvider provider);

    boolean existsByProviderAndProviderUserId(AuthProvider provider, String providerUserId);

    boolean existsByProviderAndLoginEmail(AuthProvider provider, String loginEmail);
}
