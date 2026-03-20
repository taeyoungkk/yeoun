CREATE TABLE location_logs_clean (
    location_clean_log_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    client_log_uuid VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    accuracy_m NUMERIC(8,2) NOT NULL,
    speed_mps NUMERIC(8,2),
    heading NUMERIC(6,2),
    source VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_location_logs_clean_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_location_logs_clean_trip_user_client_log
        UNIQUE (trip_id, user_id, client_log_uuid)
);

CREATE INDEX ix_location_logs_clean_trip_recorded_at
    ON location_logs_clean (trip_id, recorded_at);
