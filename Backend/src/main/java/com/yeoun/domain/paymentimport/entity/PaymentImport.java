package com.yeoun.domain.paymentimport.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
        name = "payment_imports",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_payment_imports_user_source_external_unique_no",
                        columnNames = {"user_id", "source_type", "external_transaction_unique_no"}
                ),
                @UniqueConstraint(
                        name = "ux_payment_imports_linked_expense_id",
                        columnNames = {"linked_expense_id"}
                )
        }
)
public class PaymentImport {

    @Id
    @Column(name = "payment_import_id", nullable = false, updatable = false)
    private UUID paymentImportId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "trip_id")
    private UUID tripId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    private PaymentImportSourceType sourceType;

    @Column(name = "merchant_name", nullable = false)
    private String merchantName;

    @Column(name = "transaction_summary")
    private String transactionSummary;

    @Column(name = "approved_amount", nullable = false)
    private BigDecimal approvedAmount;

    @Column(name = "currency_code", nullable = false)
    private String currencyCode;

    @Column(name = "approved_at", nullable = false)
    private Instant approvedAt;

    @Column(name = "card_name")
    private String cardName;

    @Column(name = "account_no")
    private String accountNo;

    @Column(name = "approval_no")
    private String approvalNo;

    @Column(name = "external_transaction_unique_no", nullable = false)
    private String externalTransactionUniqueNo;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode rawPayloadJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentImportStatus status;

    @Column(name = "linked_expense_id")
    private UUID linkedExpenseId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void markSelected(UUID tripId, UUID expenseId, Instant now) {
        this.tripId = tripId;
        this.linkedExpenseId = expenseId;
        this.status = PaymentImportStatus.SELECTED;
        this.updatedAt = now;
    }

    public void markIgnored(Instant now) {
        this.status = PaymentImportStatus.IGNORED;
        this.updatedAt = now;
    }

    public void refreshFromSync(
            String merchantName,
            String transactionSummary,
            BigDecimal approvedAmount,
            String currencyCode,
            Instant approvedAt,
            String cardName,
            String accountNo,
            String approvalNo,
            JsonNode rawPayloadJson,
            Instant now
    ) {
        this.merchantName = merchantName;
        this.transactionSummary = transactionSummary;
        this.approvedAmount = approvedAmount;
        this.currencyCode = currencyCode;
        this.approvedAt = approvedAt;
        this.cardName = cardName;
        this.accountNo = accountNo;
        this.approvalNo = approvalNo;
        this.rawPayloadJson = rawPayloadJson;
        this.updatedAt = now;
    }
}
