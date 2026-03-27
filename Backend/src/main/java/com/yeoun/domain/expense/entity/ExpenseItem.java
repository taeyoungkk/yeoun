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
        name = "expense_items",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_expense_items_expense_id_source_receipt_ocr_line_item_row_id",
                        columnNames = {"expense_id", "source_receipt_ocr_line_item_row_id"}
                )
        }
)
public class ExpenseItem {

    @Id
    @Column(name = "expense_item_id", nullable = false, updatable = false)
    private UUID expenseItemId;

    @Column(name = "expense_id", nullable = false)
    private UUID expenseId;

    @Column(name = "source_receipt_ocr_line_item_row_id", nullable = false)
    private UUID sourceReceiptOcrLineItemRowId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
