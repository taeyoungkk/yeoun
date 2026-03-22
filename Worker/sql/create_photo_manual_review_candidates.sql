CREATE TABLE photo_manual_review_candidates (
    candidate_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    photo_id UUID NOT NULL,
    review_status VARCHAR(30) NOT NULL,
    review_reason VARCHAR(50) NOT NULL,
    confidence_score DOUBLE PRECISION,
    suggested_place_id UUID,
    suggested_client_log_uuid UUID,
    suggested_recorded_at TIMESTAMPTZ,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_photo_manual_review_candidates_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_manual_review_candidates_photo_id
        FOREIGN KEY (photo_id)
        REFERENCES photos (photo_id)
        ON DELETE CASCADE
);

CREATE INDEX ix_photo_manual_review_candidates_trip_status
    ON photo_manual_review_candidates (trip_id, review_status, review_reason, updated_at);
