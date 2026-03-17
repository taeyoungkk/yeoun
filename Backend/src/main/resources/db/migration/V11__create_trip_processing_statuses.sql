CREATE TABLE trip_processing_statuses (
    trip_id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    last_requested_at TIMESTAMPTZ,
    last_processed_at TIMESTAMPTZ,
    last_error_message VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_trip_processing_statuses_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_trip_processing_statuses_status
        CHECK (status IN ('PENDING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED'))
);

CREATE INDEX ix_trip_processing_statuses_status_updated_at
    ON trip_processing_statuses (status, updated_at);
