package com.yeoun.domain.paymentimport.repository;

import com.yeoun.domain.paymentimport.entity.UserFinanceAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserFinanceAccountRepository extends JpaRepository<UserFinanceAccount, UUID> {

    List<UserFinanceAccount> findByFinanceProfileIdOrderByAccountNoAsc(UUID financeProfileId);

    List<UserFinanceAccount> findByFinanceProfileIdAndActiveTrueOrderByAccountNoAsc(UUID financeProfileId);

    Optional<UserFinanceAccount> findByFinanceProfileIdAndAccountNo(UUID financeProfileId, String accountNo);
}
