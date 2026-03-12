CREATE TABLE friendships (
    friendship_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    friend_user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_friendships_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_friendships_friend_user_id
        FOREIGN KEY (friend_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_friendships_status
        CHECK (status IN ('REQUESTED', 'ACCEPTED', 'BLOCKED', 'DECLINED')),
    CONSTRAINT chk_friendships_not_self
        CHECK (user_id <> friend_user_id),
    CONSTRAINT ux_friendships_user_id_friend_user_id
        UNIQUE (user_id, friend_user_id)
);

CREATE UNIQUE INDEX ux_friendships_user_pair
    ON friendships (LEAST(user_id, friend_user_id), GREATEST(user_id, friend_user_id));

CREATE INDEX ix_friendships_user_id_status
    ON friendships (user_id, status);

CREATE INDEX ix_friendships_friend_user_id_status
    ON friendships (friend_user_id, status);
