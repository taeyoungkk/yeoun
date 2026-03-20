CREATE TABLE location_route_days (
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

CREATE INDEX ix_location_route_days_trip_day
    ON location_route_days (trip_id, day);
