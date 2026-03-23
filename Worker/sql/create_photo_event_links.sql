CREATE TABLE photo_event_links (
    candidate_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    photo_id UUID NOT NULL,
    place_id UUID,
    event_type VARCHAR(30) NOT NULL,
    day_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    is_representative BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_photo_event_links_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_event_links_photo_id
        FOREIGN KEY (photo_id)
        REFERENCES photos (photo_id)
        ON DELETE CASCADE
);

CREATE INDEX ix_photo_event_links_trip_day
    ON photo_event_links (trip_id, day_date, event_type, sort_order);
