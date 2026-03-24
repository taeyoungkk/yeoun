package com.yeoun.domain.paymentimport.entity;

import com.fasterxml.jackson.databind.JsonNode;
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
        name = "user_finance_accounts",
        uniqueConstraints = {
                @UniqueConstraint(name = "ux_user_finance_accounts_profile_account_no", columnNames = {"finance_profile_id", "account_no"})
        }
)
public class UserFinanceAccount {

    @Id
    @Column(name = "finance_account_id", nullable = false, updatable = false)
    private UUID financeAccountId;

    @Column(name = "finance_profile_id", nullable = false)
    private UUID financeProfileId;

    @Column(name = "account_no", nullable = false)
    private String accountNo;

    @Column(name = "account_name")
    private String accountName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode rawPayloadJson;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void refresh(String accountName, JsonNode rawPayloadJson, Instant now) {
        this.accountName = accountName;
        this.rawPayloadJson = rawPayloadJson;
        this.active = true;
        this.updatedAt = now;
    }

    public void markInactive(Instant now) {
        this.active = false;
        this.updatedAt = now;
    }
}
