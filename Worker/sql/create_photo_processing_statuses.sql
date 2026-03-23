CREATE TABLE photo_processing_statuses (
    photo_id UUID PRIMARY KEY,
    trip_id UUID,
    status VARCHAR(30) NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 0,
    last_requested_at TIMESTAMPTZ,
    last_processed_at TIMESTAMPTZ,
    last_error_code VARCHAR(100),
    last_error_message VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_photo_processing_statuses_photo_id
        FOREIGN KEY (photo_id)
        REFERENCES photos (photo_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_processing_statuses_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT ck_photo_processing_statuses_status
        CHECK (status IN ('PROCESSING', 'READY', 'RETRY_SCHEDULED', 'DLQ'))
);

CREATE INDEX ix_photo_processing_statuses_trip_id_status
    ON photo_processing_statuses (trip_id, status, updated_at);
