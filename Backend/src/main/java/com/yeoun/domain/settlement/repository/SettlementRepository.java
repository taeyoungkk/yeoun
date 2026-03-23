package com.yeoun.domain.settlement.repository;

import com.yeoun.domain.settlement.entity.Settlement;
import com.yeoun.domain.settlement.entity.SettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<Settlement, UUID> {

    Optional<Settlement> findBySettlementId(UUID settlementId);

    List<Settlement> findByTripIdOrderByVersionNoDesc(UUID tripId);

    Optional<Settlement> findTopByTripIdOrderByVersionNoDesc(UUID tripId);

    Optional<Settlement> findByTripIdAndStatus(UUID tripId, SettlementStatus status);
}
