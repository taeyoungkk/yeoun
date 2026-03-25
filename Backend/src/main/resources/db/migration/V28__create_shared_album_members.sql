CREATE TABLE IF NOT EXISTS shared_album_members (
    shared_album_member_id UUID PRIMARY KEY,
    shared_album_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_shared_album_members_shared_album_id
        FOREIGN KEY (shared_album_id)
        REFERENCES shared_albums (shared_album_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_shared_album_members_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_shared_album_members_shared_album_user
        UNIQUE (shared_album_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_shared_album_members_shared_album_id
    ON shared_album_members (shared_album_id);
