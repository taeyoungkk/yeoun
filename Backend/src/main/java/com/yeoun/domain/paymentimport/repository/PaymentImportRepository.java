package com.yeoun.domain.paymentimport.repository;

import com.yeoun.domain.paymentimport.entity.PaymentImport;
import com.yeoun.domain.paymentimport.entity.PaymentImportStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentImportRepository extends JpaRepository<PaymentImport, UUID> {

    Optional<PaymentImport> findByPaymentImportId(UUID paymentImportId);

    Optional<PaymentImport> findByUserIdAndSourceTypeAndExternalTransactionUniqueNo(
            UUID userId,
            com.yeoun.domain.paymentimport.entity.PaymentImportSourceType sourceType,
            String externalTransactionUniqueNo
    );

    List<PaymentImport> findByUserIdAndStatusOrderByApprovedAtDescCreatedAtDesc(UUID userId, PaymentImportStatus status);

    List<PaymentImport> findByUserIdAndStatusAndApprovedAtGreaterThanEqualAndApprovedAtLessThanOrderByApprovedAtDescCreatedAtDesc(
            UUID userId,
            PaymentImportStatus status,
            Instant approvedAtFrom,
            Instant approvedAtToExclusive
    );
}
