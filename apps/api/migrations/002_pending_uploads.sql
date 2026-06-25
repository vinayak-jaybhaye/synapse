CREATE TABLE pending_uploads (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    file_name TEXT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_pending_uploads_expired ON pending_uploads(expires_at) WHERE status != 'CONSUMED';
