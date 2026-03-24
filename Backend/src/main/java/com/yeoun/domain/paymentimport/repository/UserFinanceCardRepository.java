package com.yeoun.domain.paymentimport.repository;

import com.yeoun.domain.paymentimport.entity.UserFinanceCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserFinanceCardRepository extends JpaRepository<UserFinanceCard, UUID> {

    List<UserFinanceCard> findByFinanceProfileIdOrderByCardNameAscCardNoAsc(UUID financeProfileId);

    List<UserFinanceCard> findByFinanceProfileIdAndActiveTrueOrderByCardNameAscCardNoAsc(UUID financeProfileId);

    Optional<UserFinanceCard> findByFinanceProfileIdAndCardNo(UUID financeProfileId, String cardNo);

    Optional<UserFinanceCard> findByFinanceCardId(UUID financeCardId);
}
