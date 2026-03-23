package com.yeoun.domain.settlement.repository;

import com.yeoun.domain.settlement.entity.SettlementTransfer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SettlementTransferRepository extends JpaRepository<SettlementTransfer, UUID> {

    Optional<SettlementTransfer> findBySettlementTransferId(UUID settlementTransferId);

    List<SettlementTransfer> findBySettlementIdOrderByCreatedAtAsc(UUID settlementId);

    long countBySettlementId(UUID settlementId);
}
