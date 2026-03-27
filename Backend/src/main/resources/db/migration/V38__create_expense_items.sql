CREATE TABLE expense_items (
    expense_item_id UUID PRIMARY KEY,
    expense_id UUID NOT NULL,
    source_receipt_ocr_line_item_row_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    sort_order INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_expense_items_expense_id
        FOREIGN KEY (expense_id)
        REFERENCES expenses (expense_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_expense_items_source_receipt_ocr_line_item_row_id
        FOREIGN KEY (source_receipt_ocr_line_item_row_id)
        REFERENCES receipt_ocr_line_items (receipt_ocr_line_item_row_id)
        ON DELETE RESTRICT,
    CONSTRAINT ux_expense_items_expense_id_source_receipt_ocr_line_item_row_id
        UNIQUE (expense_id, source_receipt_ocr_line_item_row_id),
    CONSTRAINT ck_expense_items_amount_positive
        CHECK (amount > 0),
    CONSTRAINT ck_expense_items_sort_order_non_negative
        CHECK (sort_order >= 0)
);

CREATE INDEX ix_expense_items_expense_id
    ON expense_items (expense_id);

CREATE INDEX ix_expense_items_source_receipt_ocr_line_item_row_id
    ON expense_items (source_receipt_ocr_line_item_row_id);

CREATE TABLE expense_item_splits (
    expense_item_split_id UUID PRIMARY KEY,
    expense_item_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_expense_item_splits_expense_item_id
        FOREIGN KEY (expense_item_id)
        REFERENCES expense_items (expense_item_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_expense_item_splits_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_expense_item_splits_expense_item_id_user_id
        UNIQUE (expense_item_id, user_id),
    CONSTRAINT ck_expense_item_splits_amount_non_negative
        CHECK (amount >= 0)
);

CREATE INDEX ix_expense_item_splits_expense_item_id
    ON expense_item_splits (expense_item_id);
