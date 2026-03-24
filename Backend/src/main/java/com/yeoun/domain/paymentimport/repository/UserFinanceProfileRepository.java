package com.yeoun.domain.paymentimport.repository;

import com.yeoun.domain.paymentimport.entity.UserFinanceProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserFinanceProfileRepository extends JpaRepository<UserFinanceProfile, UUID> {

    Optional<UserFinanceProfile> findByUserId(UUID userId);
}
