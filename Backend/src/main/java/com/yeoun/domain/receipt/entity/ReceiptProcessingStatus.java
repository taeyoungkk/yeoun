package com.yeoun.domain.receipt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Getter
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "receipt_processing_statuses")
public class ReceiptProcessingStatus {

    @Id
    @Column(name = "receipt_id", nullable = false, updatable = false)
    private String receiptId;

    @Column(name = "trip_id")
    private String tripId;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "attempt", nullable = false)
    private int attempt;

    @Column(name = "last_requested_at")
    private Instant lastRequestedAt;

    @Column(name = "last_processed_at")
    private Instant lastProcessedAt;

    @Column(name = "last_error_code")
    private String lastErrorCode;

    @Column(name = "last_error_message")
    private String lastErrorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
