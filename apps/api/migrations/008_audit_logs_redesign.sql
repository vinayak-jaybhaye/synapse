-- +goose Up
DROP TABLE IF EXISTS audit_logs;

CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    
    -- Actor Immutable Snapshot
    actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_username VARCHAR(32) NOT NULL,
    actor_display_name VARCHAR(64),
    actor_avatar_key TEXT,

    action SMALLINT NOT NULL,

    -- Target Immutable Snapshot
    target_type SMALLINT NOT NULL,
    target_id BIGINT,
    target_display TEXT,

    reason TEXT,

    changes JSONB,
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimized Indexes
CREATE INDEX idx_audit_logs_guild_id ON audit_logs (guild_id, id DESC);
CREATE INDEX idx_audit_logs_guild_action ON audit_logs (guild_id, action, id DESC);
CREATE INDEX idx_audit_logs_guild_target ON audit_logs (guild_id, target_type, target_id, id DESC);
CREATE INDEX idx_audit_logs_guild_actor ON audit_logs (guild_id, actor_id, id DESC);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
