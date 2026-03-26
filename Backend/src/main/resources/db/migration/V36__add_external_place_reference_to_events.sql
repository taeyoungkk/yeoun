ALTER TABLE events
    ADD COLUMN place_provider VARCHAR(20),
    ADD COLUMN provider_place_id VARCHAR(100);

CREATE INDEX ix_events_place_provider_provider_place_id
    ON events (place_provider, provider_place_id);
