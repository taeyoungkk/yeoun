ALTER TABLE events
    ADD COLUMN is_place_name_locked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX ix_events_trip_id_place_name_locked
    ON events (trip_id, is_place_name_locked);
