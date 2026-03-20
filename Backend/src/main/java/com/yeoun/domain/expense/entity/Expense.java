package com.yeoun.domain.expense.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "expenses")
public class Expense {

    @Id
    @Column(name = "expense_id", nullable = false, updatable = false)
    private UUID expenseId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "payer_user_id", nullable = false)
    private UUID payerUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    private ExpenseSourceType sourceType;

    @Column(name = "payment_import_id")
    private UUID paymentImportId;

    @Column(name = "merchant_name", nullable = false)
    private String merchantName;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false)
    private ExpenseCategory category;

    @Column(name = "currency_code", nullable = false)
    private String currencyCode;

    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;

    @Column(name = "paid_at", nullable = false)
    private Instant paidAt;

    @Column(name = "memo")
    private String memo;

    @Enumerated(EnumType.STRING)
    @Column(name = "split_type", nullable = false)
    private ExpenseSplitType splitType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ExpenseStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void update(
            String merchantName,
            ExpenseCategory category,
            String currencyCode,
            BigDecimal totalAmount,
            Instant paidAt,
            UUID payerUserId,
            String memo,
            Instant now
    ) {
        this.merchantName = merchantName;
        this.category = category;
        this.currencyCode = currencyCode;
        this.totalAmount = totalAmount;
        this.paidAt = paidAt;
        this.payerUserId = payerUserId;
        this.memo = memo;
        this.updatedAt = now;
    }

    public void markDeleted(Instant now) {
        this.status = ExpenseStatus.DELETED;
        this.updatedAt = now;
    }
}
