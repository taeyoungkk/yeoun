CREATE TABLE photo_memos (
    photo_memo_id UUID PRIMARY KEY,
    photo_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_photo_memos_photo_id
        FOREIGN KEY (photo_id)
        REFERENCES photos (photo_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_memos_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_photo_memos_photo_id_user_id
        UNIQUE (photo_id, user_id),
    CONSTRAINT ck_photo_memos_content_not_blank
        CHECK (char_length(btrim(content)) > 0),
    CONSTRAINT ck_photo_memos_content_max_length
        CHECK (char_length(content) <= 1000)
);

CREATE INDEX ix_photo_memos_user_id_photo_id
    ON photo_memos (user_id, photo_id);
