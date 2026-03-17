CREATE TABLE location_logs_raw (
    location_log_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    accuracy_m NUMERIC(8,2) NOT NULL,
    speed_mps NUMERIC(8,2),
    heading NUMERIC(6,2),
    source VARCHAR(20) NOT NULL,
    client_log_uuid VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_location_logs_raw_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_location_logs_raw_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_location_logs_raw_trip_user_client_log
        UNIQUE (trip_id, user_id, client_log_uuid),
    CONSTRAINT chk_location_logs_raw_speed
        CHECK (speed_mps IS NULL OR speed_mps >= 0),
    CONSTRAINT chk_location_logs_raw_heading
        CHECK (heading IS NULL OR (heading >= 0 AND heading < 360)),
    CONSTRAINT chk_location_logs_raw_source
        CHECK (source IN ('GPS', 'NETWORK', 'MANUAL'))
);

CREATE INDEX ix_location_logs_raw_trip_recorded_at
    ON location_logs_raw (trip_id, recorded_at);

CREATE INDEX ix_location_logs_raw_trip_user_recorded_at
    ON location_logs_raw (trip_id, user_id, recorded_at);
