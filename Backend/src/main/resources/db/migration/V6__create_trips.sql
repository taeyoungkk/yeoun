CREATE TABLE trips (
    trip_id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    actual_ended_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    report_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_trips_owner_user_id
        FOREIGN KEY (owner_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_trips_status
        CHECK (status IN ('DRAFT', 'ACTIVE', 'ENDED', 'DELETED')),
    CONSTRAINT chk_trips_visibility
        CHECK (visibility IN ('PRIVATE', 'PARTIAL_PUBLIC', 'PUBLIC')),
    CONSTRAINT chk_trips_report_status
        CHECK (report_status IN ('PENDING', 'GENERATING', 'READY', 'FAILED')),
    CONSTRAINT chk_trips_date_range
        CHECK (start_date <= end_date)
);

CREATE TABLE trip_members (
    trip_member_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    invite_status VARCHAR(20) NOT NULL,
    invited_by_user_id UUID,
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_trip_members_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_trip_members_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_trip_members_invited_by_user_id
        FOREIGN KEY (invited_by_user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL,
    CONSTRAINT chk_trip_members_invite_status
        CHECK (invite_status IN ('INVITED', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
    CONSTRAINT ux_trip_members_trip_id_user_id
        UNIQUE (trip_id, user_id)
);

CREATE INDEX ix_trips_owner_user_id_status
    ON trips (owner_user_id, status);

CREATE INDEX ix_trip_members_user_id_invite_status
    ON trip_members (user_id, invite_status);
