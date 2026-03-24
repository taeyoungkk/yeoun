CREATE TABLE payment_imports (
    payment_import_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    trip_id UUID,
    source_type VARCHAR(30) NOT NULL,
    merchant_name VARCHAR(255) NOT NULL,
    transaction_summary VARCHAR(255),
    approved_amount NUMERIC(18, 2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL,
    card_name VARCHAR(100),
    account_no VARCHAR(50),
    approval_no VARCHAR(100),
    external_transaction_unique_no VARCHAR(100) NOT NULL,
    raw_payload_json JSONB NOT NULL,
    status VARCHAR(20) NOT NULL,
    linked_expense_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_payment_imports_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_payment_imports_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_payment_imports_linked_expense_id
        FOREIGN KEY (linked_expense_id)
        REFERENCES expenses (expense_id)
        ON DELETE SET NULL,
    CONSTRAINT ux_payment_imports_user_source_external_unique_no
        UNIQUE (user_id, source_type, external_transaction_unique_no),
    CONSTRAINT ux_payment_imports_linked_expense_id
        UNIQUE (linked_expense_id),
    CONSTRAINT ck_payment_imports_source_type
        CHECK (source_type IN ('DEMAND_DEPOSIT', 'CREDIT_CARD')),
    CONSTRAINT ck_payment_imports_status
        CHECK (status IN ('CANDIDATE', 'SELECTED', 'IGNORED')),
    CONSTRAINT ck_payment_imports_amount_positive
        CHECK (approved_amount > 0),
    CONSTRAINT ck_payment_imports_selected_consistency
        CHECK (
            (status IN ('CANDIDATE', 'IGNORED') AND linked_expense_id IS NULL)
            OR (status = 'SELECTED' AND linked_expense_id IS NOT NULL AND trip_id IS NOT NULL)
        )
);

CREATE INDEX ix_payment_imports_user_id_status_approved_at
    ON payment_imports (user_id, status, approved_at DESC);

CREATE INDEX ix_payment_imports_trip_id_status_approved_at
    ON payment_imports (trip_id, status, approved_at DESC);

ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS fk_expenses_payment_import_id;

ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_payment_import_id
        FOREIGN KEY (payment_import_id)
        REFERENCES payment_imports (payment_import_id)
        ON DELETE RESTRICT;
