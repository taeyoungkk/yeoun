CREATE TABLE IF NOT EXISTS shared_album_event_selections (
    shared_album_event_selection_id UUID PRIMARY KEY,
    shared_album_id UUID NOT NULL,
    event_id UUID NOT NULL,
    display_order INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_shared_album_event_selections_shared_album_id
        FOREIGN KEY (shared_album_id)
        REFERENCES shared_albums (shared_album_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_shared_album_event_selections_event_id
        FOREIGN KEY (event_id)
        REFERENCES events (event_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_shared_album_event_selections_shared_album_event
        UNIQUE (shared_album_id, event_id)
);

CREATE INDEX IF NOT EXISTS ix_shared_album_event_selections_shared_album_id
    ON shared_album_event_selections (shared_album_id, display_order);
