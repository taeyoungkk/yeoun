ALTER TABLE trip_sync_statuses
    ADD COLUMN pending_photo_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN pending_location_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trip_sync_statuses
    ADD CONSTRAINT chk_trip_sync_statuses_pending_photo_count_non_negative
        CHECK (pending_photo_count >= 0),
    ADD CONSTRAINT chk_trip_sync_statuses_pending_location_count_non_negative
        CHECK (pending_location_count >= 0);
