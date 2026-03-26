package com.yeoun.domain.receipt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "receipt_ocr_results")
public class ReceiptOcrResult {

    @Id
    @Column(name = "receipt_id", nullable = false, updatable = false)
    private String receiptId;

    @Column(name = "trip_id")
    private String tripId;

    @Column(name = "image_url", nullable = false)
    private String imageUrl;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "merchant_name")
    private String merchantName;

    @Column(name = "paid_at_raw")
    private String paidAtRaw;

    @Column(name = "currency_code")
    private String currencyCode;

    @Column(name = "total_amount")
    private BigDecimal totalAmount;

    @Column(name = "tax_amount")
    private BigDecimal taxAmount;

    @Column(name = "raw_text")
    private String rawText;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "attempt", nullable = false)
    private int attempt;

    @Column(name = "requested_at")
    private Instant requestedAt;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
