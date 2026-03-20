CREATE TABLE photo_place_links (
    photo_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    place_id UUID NOT NULL,
    linked_by VARCHAR(30) NOT NULL,
    match_type VARCHAR(30) NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL,
    representative_scope VARCHAR(30) NOT NULL,
    representative_scope_id UUID NOT NULL,
    is_representative BOOLEAN NOT NULL DEFAULT FALSE,
    representative_rank INTEGER NOT NULL,
    selection_reason VARCHAR(100) NOT NULL,
    selected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_photo_place_links_photo_id
        FOREIGN KEY (photo_id)
        REFERENCES photos (photo_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_place_links_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE
);

CREATE INDEX ix_photo_place_links_trip_place
    ON photo_place_links (trip_id, place_id, representative_rank);
