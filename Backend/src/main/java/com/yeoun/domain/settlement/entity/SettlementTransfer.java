package com.yeoun.domain.settlement.entity;

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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
        name = "settlement_transfers",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_settlement_transfers_settlement_id_from_to",
                        columnNames = {"settlement_id", "from_user_id", "to_user_id"}
                )
        }
)
public class SettlementTransfer {

    @Id
    @Column(name = "settlement_transfer_id", nullable = false, updatable = false)
    private UUID settlementTransferId;

    @Column(name = "settlement_id", nullable = false)
    private UUID settlementId;

    @Column(name = "from_user_id", nullable = false)
    private UUID fromUserId;

    @Column(name = "to_user_id", nullable = false)
    private UUID toUserId;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false)
    private String currencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private SettlementTransferStatus status;

    @Column(name = "settled_at")
    private Instant settledAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void markSettled(Instant now) {
        this.status = SettlementTransferStatus.SETTLED;
        this.settledAt = now;
        this.updatedAt = now;
    }
}
