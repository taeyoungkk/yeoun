ALTER TABLE shared_albums
    ADD COLUMN IF NOT EXISTS region_label VARCHAR(100);
