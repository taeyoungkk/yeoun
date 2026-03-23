CREATE TABLE location_timeline_candidates (
    location_timeline_candidate_row_id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    candidate_type VARCHAR(30) NOT NULL,
    reference_id VARCHAR(120) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_location_timeline_candidates_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_location_timeline_candidates_candidate_id
        UNIQUE (candidate_id),
    CONSTRAINT ux_location_timeline_candidates_trip_reference
        UNIQUE (trip_id, user_id, candidate_type, reference_id)
);

CREATE INDEX ix_location_timeline_candidates_trip_started_at
    ON location_timeline_candidates (trip_id, started_at);
