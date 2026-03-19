CREATE TABLE timeline_days (
    timeline_day_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    day_date DATE NOT NULL,
    summary_text TEXT,
    distance_m NUMERIC(12, 2),
    photo_count INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_timeline_days_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_timeline_days_trip_id_day_date
        UNIQUE (trip_id, day_date),
    CONSTRAINT ck_timeline_days_distance_m_non_negative
        CHECK (distance_m IS NULL OR distance_m >= 0),
    CONSTRAINT ck_timeline_days_photo_count_non_negative
        CHECK (photo_count >= 0),
    CONSTRAINT ck_timeline_days_event_count_non_negative
        CHECK (event_count >= 0)
);

CREATE INDEX ix_timeline_days_trip_id_day_date
    ON timeline_days (trip_id, day_date);

CREATE TABLE events (
    event_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    timeline_day_id UUID NOT NULL,
    created_by VARCHAR(20) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    title VARCHAR(255),
    place_name VARCHAR(255),
    place_external_id VARCHAR(255),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    center_latitude NUMERIC(10, 7),
    center_longitude NUMERIC(10, 7),
    radius_m NUMERIC(12, 2),
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_events_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_events_timeline_day_id
        FOREIGN KEY (timeline_day_id)
        REFERENCES timeline_days (timeline_day_id)
        ON DELETE CASCADE,
    CONSTRAINT ck_events_created_by
        CHECK (created_by IN ('SYSTEM', 'USER')),
    CONSTRAINT ck_events_event_type
        CHECK (event_type IN ('PLACE_VISIT', 'MOVE', 'OTHER')),
    CONSTRAINT ck_events_time_range
        CHECK (start_at <= end_at),
    CONSTRAINT ck_events_radius_m_non_negative
        CHECK (radius_m IS NULL OR radius_m >= 0)
);

CREATE INDEX ix_events_timeline_day_id_start_at
    ON events (timeline_day_id, start_at, end_at);

CREATE INDEX ix_events_trip_id_is_hidden_start_at
    ON events (trip_id, is_hidden, start_at);

CREATE TABLE event_photos (
    event_photo_id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    photo_id UUID NOT NULL,
    sort_order INTEGER NOT NULL,
    is_representative BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_event_photos_event_id
        FOREIGN KEY (event_id)
        REFERENCES events (event_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_event_photos_photo_id
        FOREIGN KEY (photo_id)
        REFERENCES photos (photo_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_event_photos_event_id_photo_id
        UNIQUE (event_id, photo_id),
    CONSTRAINT ux_event_photos_event_id_sort_order
        UNIQUE (event_id, sort_order),
    CONSTRAINT ck_event_photos_sort_order_min
        CHECK (sort_order >= 1)
);

CREATE INDEX ix_event_photos_event_id_sort_order
    ON event_photos (event_id, sort_order);

CREATE UNIQUE INDEX ux_event_photos_representative_per_event
    ON event_photos (event_id)
    WHERE is_representative = TRUE;

CREATE TABLE event_memos (
    event_memo_id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_event_memos_event_id
        FOREIGN KEY (event_id)
        REFERENCES events (event_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_event_memos_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_event_memos_event_id_user_id
        UNIQUE (event_id, user_id),
    CONSTRAINT ck_event_memos_content_not_blank
        CHECK (char_length(btrim(content)) > 0)
);

CREATE INDEX ix_event_memos_user_id_event_id
    ON event_memos (user_id, event_id);
