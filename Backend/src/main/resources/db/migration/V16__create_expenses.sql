CREATE TABLE expenses (
    expense_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    created_by_user_id UUID NOT NULL,
    payer_user_id UUID NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    payment_import_id UUID,
    merchant_name VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    total_amount NUMERIC(18, 2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    memo TEXT,
    split_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_expenses_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_expenses_created_by_user_id
        FOREIGN KEY (created_by_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_expenses_payer_user_id
        FOREIGN KEY (payer_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ck_expenses_source_type
        CHECK (source_type IN ('MANUAL', 'PAYMENT_IMPORT')),
    CONSTRAINT ck_expenses_category
        CHECK (category IN ('FOOD', 'CAFE', 'TRANSPORT', 'LODGING', 'SHOPPING', 'ETC')),
    CONSTRAINT ck_expenses_total_amount_positive
        CHECK (total_amount > 0),
    CONSTRAINT ck_expenses_split_type
        CHECK (split_type IN ('EQUAL', 'CUSTOM')),
    CONSTRAINT ck_expenses_status
        CHECK (status IN ('PENDING', 'CONFIRMED', 'DELETED'))
);

CREATE INDEX ix_expenses_trip_id_status_paid_at
    ON expenses (trip_id, status, paid_at DESC);

CREATE TABLE expense_splits (
    expense_split_id UUID PRIMARY KEY,
    expense_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_expense_splits_expense_id
        FOREIGN KEY (expense_id)
        REFERENCES expenses (expense_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_expense_splits_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_expense_splits_expense_id_user_id
        UNIQUE (expense_id, user_id),
    CONSTRAINT ck_expense_splits_amount_non_negative
        CHECK (amount >= 0)
);

CREATE INDEX ix_expense_splits_expense_id
    ON expense_splits (expense_id);
