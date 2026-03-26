package com.yeoun.domain.receipt.repository;

import com.yeoun.domain.receipt.entity.ReceiptOcrLineItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ReceiptOcrLineItemRepository extends JpaRepository<ReceiptOcrLineItem, UUID> {
    List<ReceiptOcrLineItem> findByReceiptIdOrderBySortOrderAsc(String receiptId);
}
