package com.yeoun.domain.expense.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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
@Table(
        name = "expense_item_splits",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_expense_item_splits_expense_item_id_user_id",
                        columnNames = {"expense_item_id", "user_id"}
                )
        }
)
public class ExpenseItemSplit {

    @Id
    @Column(name = "expense_item_split_id", nullable = false, updatable = false)
    private UUID expenseItemSplitId;

    @Column(name = "expense_item_id", nullable = false)
    private UUID expenseItemId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
