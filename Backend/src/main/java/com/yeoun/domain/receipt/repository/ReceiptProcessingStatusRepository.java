package com.yeoun.domain.receipt.repository;

import com.yeoun.domain.receipt.entity.ReceiptProcessingStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReceiptProcessingStatusRepository extends JpaRepository<ReceiptProcessingStatus, String> {
}
