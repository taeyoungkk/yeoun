package com.yeoun.domain.paymentimport.entity;

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

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(
        name = "user_finance_profiles",
        uniqueConstraints = {
                @UniqueConstraint(name = "ux_user_finance_profiles_user_id", columnNames = {"user_id"}),
                @UniqueConstraint(name = "ux_user_finance_profiles_finance_user_key", columnNames = {"finance_user_key"})
        }
)
public class UserFinanceProfile {

    @Id
    @Column(name = "finance_profile_id", nullable = false, updatable = false)
    private UUID financeProfileId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "finance_user_key", nullable = false)
    private String financeUserKey;

    @Column(name = "finance_user_id", nullable = false)
    private String financeUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "synced_at")
    private Instant syncedAt;

    public void updateFinanceIdentity(String financeUserId, String financeUserKey, Instant now) {
        this.financeUserId = financeUserId;
        this.financeUserKey = financeUserKey;
        this.updatedAt = now;
    }

    public void markSynced(Instant now) {
        this.syncedAt = now;
        this.updatedAt = now;
    }
}
