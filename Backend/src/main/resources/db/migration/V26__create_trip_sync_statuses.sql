CREATE TABLE trip_sync_statuses (
    trip_id UUID PRIMARY KEY,
    sync_status VARCHAR(20) NOT NULL,
    route_version BIGINT NOT NULL DEFAULT 0,
    timeline_version BIGINT NOT NULL DEFAULT 0,
    photo_version BIGINT NOT NULL DEFAULT 0,
    last_error_message VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_trip_sync_statuses_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_trip_sync_statuses_sync_status
        CHECK (sync_status IN ('IDLE', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX ix_trip_sync_statuses_sync_status_updated_at
    ON trip_sync_statuses (sync_status, updated_at);
