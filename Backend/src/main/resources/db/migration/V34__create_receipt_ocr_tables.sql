CREATE TABLE IF NOT EXISTS receipt_ocr_results (
    receipt_id TEXT PRIMARY KEY,
    trip_id TEXT,
    image_url TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    merchant_name VARCHAR(255),
    paid_at_raw TEXT,
    currency_code VARCHAR(10),
    total_amount NUMERIC(18, 2),
    tax_amount NUMERIC(18, 2),
    raw_text TEXT,
    error_code VARCHAR(100),
    error_message VARCHAR(1000),
    attempt INTEGER NOT NULL DEFAULT 0,
    requested_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_receipt_ocr_results_status
        CHECK (status IN ('COMPLETED', 'FAILED', 'RETRY_SCHEDULED'))
);

CREATE INDEX IF NOT EXISTS ix_receipt_ocr_results_trip_id_status
    ON receipt_ocr_results (trip_id, status, processed_at DESC);

CREATE TABLE IF NOT EXISTS receipt_ocr_line_items (
    receipt_ocr_line_item_row_id UUID PRIMARY KEY,
    receipt_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    unit_price NUMERIC(18, 2),
    amount NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_receipt_ocr_line_items_receipt_id
        FOREIGN KEY (receipt_id)
        REFERENCES receipt_ocr_results (receipt_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_receipt_ocr_line_items_receipt_id_sort_order
        UNIQUE (receipt_id, sort_order)
);

CREATE INDEX IF NOT EXISTS ix_receipt_ocr_line_items_receipt_id
    ON receipt_ocr_line_items (receipt_id, sort_order);

CREATE TABLE IF NOT EXISTS receipt_processing_statuses (
    receipt_id TEXT PRIMARY KEY,
    trip_id TEXT,
    status VARCHAR(30) NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 0,
    last_requested_at TIMESTAMPTZ,
    last_processed_at TIMESTAMPTZ,
    last_error_code VARCHAR(100),
    last_error_message VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_receipt_processing_statuses_status
        CHECK (status IN ('PROCESSING', 'READY', 'RETRY_SCHEDULED', 'DLQ', 'REQUESTED'))
);

CREATE INDEX IF NOT EXISTS ix_receipt_processing_statuses_trip_id_status
    ON receipt_processing_statuses (trip_id, status, updated_at);

ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS fk_expenses_receipt_id;

ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_receipt_id
        FOREIGN KEY (receipt_id)
        REFERENCES receipt_ocr_results (receipt_id)
        ON DELETE RESTRICT;
