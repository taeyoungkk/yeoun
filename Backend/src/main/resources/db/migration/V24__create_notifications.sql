CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY,
    receiver_user_id UUID NOT NULL,
    actor_user_id UUID,
    trip_id UUID,
    resource_id UUID,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(500) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    CONSTRAINT fk_notifications_receiver_user_id
        FOREIGN KEY (receiver_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_notifications_actor_user_id
        FOREIGN KEY (actor_user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_notifications_trip_id
        FOREIGN KEY (trip_id)
        REFERENCES trips (trip_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_notifications_type
        CHECK (type IN (
            'FRIEND_REQUEST_RECEIVED',
            'FRIEND_REQUEST_ACCEPTED',
            'TRIP_INVITE_RECEIVED',
            'TRIP_INVITE_ACCEPTED',
            'TRIP_INVITE_DECLINED'
        ))
);

CREATE INDEX ix_notifications_receiver_user_id_created_at
    ON notifications (receiver_user_id, created_at DESC);

CREATE INDEX ix_notifications_receiver_user_id_is_read
    ON notifications (receiver_user_id, is_read);
