CREATE TABLE receipt_processing_statuses (
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
        CHECK (status IN ('PROCESSING', 'READY', 'RETRY_SCHEDULED', 'DLQ'))
);

CREATE INDEX ix_receipt_processing_statuses_trip_id_status
    ON receipt_processing_statuses (trip_id, status, updated_at);
