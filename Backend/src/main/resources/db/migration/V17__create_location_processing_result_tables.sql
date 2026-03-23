CREATE TABLE IF NOT EXISTS location_logs_clean (
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

CREATE INDEX IF NOT EXISTS ix_location_logs_clean_trip_recorded_at
    ON location_logs_clean (trip_id, recorded_at);

CREATE TABLE IF NOT EXISTS location_route_days (
    route_day_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    day DATE NOT NULL,
    point_count INT NOT NULL,
    distance_m NUMERIC(12,2) NOT NULL,
    coordinates_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_location_route_days_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_location_route_days_trip_user_day
        UNIQUE (trip_id, user_id, day)
);

CREATE INDEX IF NOT EXISTS ix_location_route_days_trip_day
    ON location_route_days (trip_id, day);

CREATE TABLE IF NOT EXISTS location_places (
    place_row_id UUID PRIMARY KEY,
    place_id UUID NOT NULL,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_seconds INT NOT NULL,
    center_latitude NUMERIC(10,7) NOT NULL,
    center_longitude NUMERIC(10,7) NOT NULL,
    stay_segment_count INT NOT NULL,
    source VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_location_places_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_location_places_place_id
        UNIQUE (place_id)
);

CREATE INDEX IF NOT EXISTS ix_location_places_trip_started_at
    ON location_places (trip_id, started_at);
