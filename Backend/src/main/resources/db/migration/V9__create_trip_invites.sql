CREATE TABLE trip_invites (
    trip_invite_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    inviter_user_id UUID NOT NULL,
    invite_type VARCHAR(20) NOT NULL,
    invite_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL,
    target_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    CONSTRAINT fk_trip_invites_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_trip_invites_inviter_user_id
        FOREIGN KEY (inviter_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_trip_invites_target_user_id
        FOREIGN KEY (target_user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL,
    CONSTRAINT ux_trip_invites_invite_token
        UNIQUE (invite_token),
    CONSTRAINT chk_trip_invites_invite_type
        CHECK (invite_type IN ('LINK', 'USER')),
    CONSTRAINT chk_trip_invites_status
        CHECK (status IN ('SENT', 'USED', 'EXPIRED', 'CANCELLED'))
);

CREATE INDEX ix_trip_invites_trip_id_status
    ON trip_invites (trip_id, status);
