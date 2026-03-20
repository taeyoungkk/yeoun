CREATE TABLE location_places (
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

CREATE INDEX ix_location_places_trip_started_at
    ON location_places (trip_id, started_at);
