package com.yeoun.domain.receipt.repository;

import com.yeoun.domain.receipt.entity.ReceiptOcrResult;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReceiptOcrResultRepository extends JpaRepository<ReceiptOcrResult, String> {
}
