CREATE TABLE photos (
    photo_id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL,
    trip_id UUID NOT NULL,
    event_id UUID,
    storage_key VARCHAR(500) NOT NULL,
    thumbnail_key VARCHAR(500),
    file_hash VARCHAR(64) NOT NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    taken_at TIMESTAMPTZ,
    taken_timezone VARCHAR(100),
    exif_latitude NUMERIC(10, 7),
    exif_longitude NUMERIC(10, 7),
    metadata_json JSONB,
    is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_photos_owner_user_id
        FOREIGN KEY (owner_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photos_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_photos_owner_trip_hash
        UNIQUE (owner_user_id, trip_id, file_hash)
);

CREATE INDEX ix_photos_trip_id_taken_at
    ON photos (trip_id, taken_at);

CREATE INDEX ix_photos_trip_id_is_excluded_taken_at
    ON photos (trip_id, is_excluded, taken_at);

ALTER TABLE trip_members
    ADD COLUMN last_photo_synced_at TIMESTAMPTZ;
