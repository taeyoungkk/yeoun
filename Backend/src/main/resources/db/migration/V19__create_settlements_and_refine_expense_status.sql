ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS ck_expenses_status;

ALTER TABLE expenses
    ADD CONSTRAINT ck_expenses_status
        CHECK (status IN ('CONFIRMED', 'DELETED'));

CREATE TABLE settlements (
    settlement_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    version_no INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    algorithm_version VARCHAR(50) NOT NULL,
    note TEXT,
    snapshot_payload_json JSONB NOT NULL,
    created_by_user_id UUID NOT NULL,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_settlements_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_settlements_created_by_user_id
        FOREIGN KEY (created_by_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_settlements_trip_id_version_no
        UNIQUE (trip_id, version_no),
    CONSTRAINT ck_settlements_version_positive
        CHECK (version_no > 0),
    CONSTRAINT ck_settlements_status
        CHECK (status IN ('DRAFT', 'FINALIZED', 'SUPERSEDED'))
);

CREATE INDEX ix_settlements_trip_id_version_no
    ON settlements (trip_id, version_no DESC);

CREATE INDEX ix_settlements_trip_id_status
    ON settlements (trip_id, status);

CREATE TABLE settlement_transfers (
    settlement_transfer_id UUID PRIMARY KEY,
    settlement_id UUID NOT NULL,
    from_user_id UUID NOT NULL,
    to_user_id UUID NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_settlement_transfers_settlement_id
        FOREIGN KEY (settlement_id)
        REFERENCES settlements (settlement_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_settlement_transfers_from_user_id
        FOREIGN KEY (from_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_settlement_transfers_to_user_id
        FOREIGN KEY (to_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_settlement_transfers_settlement_id_from_to
        UNIQUE (settlement_id, from_user_id, to_user_id),
    CONSTRAINT ck_settlement_transfers_amount_positive
        CHECK (amount > 0),
    CONSTRAINT ck_settlement_transfers_from_not_equal_to
        CHECK (from_user_id <> to_user_id),
    CONSTRAINT ck_settlement_transfers_status
        CHECK (status IN ('PENDING', 'SETTLED')),
    CONSTRAINT ck_settlement_transfers_settled_at_consistency
        CHECK (
            (status = 'PENDING' AND settled_at IS NULL)
            OR (status = 'SETTLED' AND settled_at IS NOT NULL)
        )
);

CREATE INDEX ix_settlement_transfers_settlement_id
    ON settlement_transfers (settlement_id);

CREATE INDEX ix_settlement_transfers_from_user_id_status
    ON settlement_transfers (from_user_id, status);
