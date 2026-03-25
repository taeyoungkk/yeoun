CREATE TABLE IF NOT EXISTS shared_albums (
    shared_album_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    region_label VARCHAR(100),
    description TEXT,
    visibility VARCHAR(20) NOT NULL,
    cover_photo_id UUID,
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_shared_albums_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_shared_albums_cover_photo_id
        FOREIGN KEY (cover_photo_id)
        REFERENCES photos (photo_id)
        ON DELETE SET NULL,
    CONSTRAINT ux_shared_albums_trip_id
        UNIQUE (trip_id)
);

CREATE INDEX IF NOT EXISTS ix_shared_albums_visibility
    ON shared_albums (visibility);
