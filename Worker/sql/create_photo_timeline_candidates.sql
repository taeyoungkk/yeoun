CREATE TABLE photo_timeline_candidates (
    photo_timeline_candidate_row_id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL,
    trip_id UUID NOT NULL,
    photo_id UUID NOT NULL,
    place_id UUID,
    candidate_type VARCHAR(30) NOT NULL,
    day_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    is_representative BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL,
    metadata_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_photo_timeline_candidates_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_timeline_candidates_photo_id
        FOREIGN KEY (photo_id)
        REFERENCES photos (photo_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_photo_timeline_candidates_candidate_id
        UNIQUE (candidate_id),
    CONSTRAINT ck_photo_timeline_candidates_type
        CHECK (candidate_type IN ('PLACE_PHOTO', 'UNMATCHED_PHOTO')),
    CONSTRAINT ck_photo_timeline_candidates_sort_order
        CHECK (sort_order >= 1)
);

CREATE INDEX ix_photo_timeline_candidates_trip_day_date
    ON photo_timeline_candidates (trip_id, day_date);
