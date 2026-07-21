-- +goose Up
CREATE TABLE notifications (
    id BIGINT PRIMARY KEY,
    recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    type SMALLINT NOT NULL,
    reference_type SMALLINT NOT NULL,
    reference_id BIGINT NOT NULL,
    metadata JSONB,
    deduplication_key VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_id) WHERE is_read = false;
CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE UNIQUE INDEX idx_notifications_dedup ON notifications(recipient_id, deduplication_key) WHERE deduplication_key IS NOT NULL;
-- +goose Down
DROP TABLE IF EXISTS notifications;
