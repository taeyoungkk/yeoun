package com.yeoun.domain.settlement.entity;

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

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
        name = "settlements",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_settlements_trip_id_version_no",
                        columnNames = {"trip_id", "version_no"}
                )
        }
)
public class Settlement {

    @Id
    @Column(name = "settlement_id", nullable = false, updatable = false)
    private UUID settlementId;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private SettlementStatus status;

    @Column(name = "algorithm_version", nullable = false)
    private String algorithmVersion;

    @Column(name = "note")
    private String note;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "snapshot_payload_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode snapshotPayloadJson;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "finalized_at")
    private Instant finalizedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void finalizeSettlement(Instant now) {
        this.status = SettlementStatus.FINALIZED;
        this.finalizedAt = now;
        this.updatedAt = now;
    }

    public void supersede(Instant now) {
        this.status = SettlementStatus.SUPERSEDED;
        this.updatedAt = now;
    }
}
