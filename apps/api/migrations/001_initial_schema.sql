-- 1. Core Entities
CREATE TABLE
  users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(64),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_key TEXT,
    banner_key TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW (),
    updated_at TIMESTAMPTZ DEFAULT NOW ()
  );

CREATE TABLE
  guilds (
    id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users (id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_key TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW (),
    updated_at TIMESTAMPTZ DEFAULT NOW (),
    deleted_at TIMESTAMPTZ
  );

CREATE INDEX idx_guilds_owner ON guilds (owner_id);

CREATE TABLE
  channels (
    id BIGINT PRIMARY KEY,
    guild_id BIGINT REFERENCES guilds (id),
    parent_channel_id BIGINT REFERENCES channels (id),
    name VARCHAR(100) NOT NULL,
    type SMALLINT NOT NULL,
    position INTEGER NOT NULL,
    topic TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW (),
    updated_at TIMESTAMPTZ DEFAULT NOW (),
    deleted_at TIMESTAMPTZ,
    CHECK (
      (
        type IN (3, 4)
        AND guild_id IS NULL
      )
      OR (
        type NOT IN (3, 4)
        AND guild_id IS NOT NULL
      )
    )
  );

-- COALESCE handles top-level categories where parent_channel_id is NULL
CREATE UNIQUE INDEX idx_channel_position ON channels (
  guild_id,
  COALESCE(parent_channel_id, 0),
  position
)
WHERE
  deleted_at IS NULL;

-- 2. O(1) Direct Message Discovery
CREATE TABLE
  direct_conversations (
    id BIGINT PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES channels (id),
    user1_id BIGINT NOT NULL REFERENCES users (id),
    user2_id BIGINT NOT NULL REFERENCES users (id),
    UNIQUE (user1_id, user2_id),
    -- Enforces canonical ordering AND prevents self-DMs (user1 cannot equal user1)
    CHECK (user1_id < user2_id)
  );

CREATE UNIQUE INDEX idx_dm_channel ON direct_conversations (channel_id);

-- 3. Membership, Moderation & Invites
CREATE TABLE
  guild_members (
    guild_id BIGINT REFERENCES guilds (id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users (id),
    nickname VARCHAR(64),
    joined_at TIMESTAMPTZ DEFAULT NOW (),
    is_muted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (guild_id, user_id)
  );

CREATE INDEX idx_guild_members_user_id ON guild_members (user_id, guild_id);

CREATE INDEX idx_guild_members_joined ON guild_members (guild_id, joined_at);

CREATE TABLE
  guild_bans (
    guild_id BIGINT REFERENCES guilds (id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users (id),
    banned_by BIGINT REFERENCES users (id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW (),
    PRIMARY KEY (guild_id, user_id)
  );

CREATE TABLE
  invites (
    id BIGINT PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds (id) ON DELETE CASCADE,
    created_by BIGINT NOT NULL REFERENCES users (id),
    code VARCHAR(32) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER DEFAULT 0,
    uses INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW ()
  );

-- 4. The Bitwise Permission Engine
CREATE TABLE
  roles (
    id BIGINT PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds (id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    color INTEGER,
    position INTEGER NOT NULL,
    permissions BIGINT NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW ()
  );

CREATE INDEX idx_roles_guild_position ON roles (guild_id, position);

-- Dropped UNIQUE for UI drag-and-drop
CREATE UNIQUE INDEX idx_default_role ON roles (guild_id)
WHERE
  is_default = TRUE;

CREATE TABLE
  member_roles (
    guild_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    PRIMARY KEY (guild_id, user_id, role_id),
    FOREIGN KEY (guild_id, user_id) REFERENCES guild_members (guild_id, user_id) ON DELETE CASCADE
  );

CREATE TABLE
  channel_role_permissions (
    channel_id BIGINT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    allow_permissions BIGINT NOT NULL DEFAULT 0,
    deny_permissions BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, role_id)
  );

-- 5. The Message Firehose, Mentions & Attachments
CREATE TABLE
  messages (
    id BIGINT PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users (id),
    reply_to_message_id BIGINT REFERENCES messages (id),
    -- 0-99: User, 100-199: Guild Events, 200-299: Voice Events, 300-399: System
    message_type SMALLINT NOT NULL DEFAULT 0,
    content TEXT,
    metadata JSONB, -- Future-proofs system events (e.g., {"call_id": "123"})
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
  );

CREATE INDEX idx_active_messages_by_channel ON messages (channel_id, id DESC)
WHERE
  deleted_at IS NULL;
CREATE INDEX idx_messages_by_channel ON messages (channel_id, id DESC);

CREATE INDEX idx_messages_author ON messages (author_id, id DESC);

CREATE INDEX idx_messages_reply ON messages (reply_to_message_id);

-- Optimizes thread lookups
CREATE TABLE
  message_attachments (
    id BIGINT PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT
  );

CREATE INDEX idx_attachments_message ON message_attachments (message_id);

CREATE TABLE
  message_reactions (
    message_id BIGINT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW (),
    PRIMARY KEY (message_id, user_id, emoji)
  );

CREATE TABLE
  message_mentions (
    message_id BIGINT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    channel_id BIGINT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    mentioned_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, mentioned_user_id)
  );

CREATE INDEX idx_mentions_channel_user ON message_mentions (channel_id, mentioned_user_id);

-- 6. State, Settings & Voice Data
CREATE TABLE
  channel_reads (
    channel_id BIGINT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id),
    last_read_message_id BIGINT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW (),
    PRIMARY KEY (channel_id, user_id)
  );

CREATE TABLE
  notification_settings (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    guild_id BIGINT REFERENCES guilds (id) ON DELETE CASCADE,
    channel_id BIGINT REFERENCES channels (id) ON DELETE CASCADE,
    mute_until TIMESTAMPTZ,
    UNIQUE NULLS NOT DISTINCT (user_id, guild_id, channel_id)
    -- Constraint removed to allow DMs (guild_id = NULL) to be muted
  );

CREATE TABLE
  voice_sessions (
    id BIGINT PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES channels (id),
    started_by BIGINT NOT NULL REFERENCES users (id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    ended_at TIMESTAMPTZ
  );

CREATE INDEX idx_voice_sessions_channel ON voice_sessions (channel_id);

-- 7. Event-Driven Architecture & Immutability
CREATE TABLE
  outbox_events (
    id BIGINT PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status SMALLINT DEFAULT 0,
    retry_count INTEGER DEFAULT 0, -- Dead-letter queue tracking
    created_at TIMESTAMPTZ DEFAULT NOW (),
    processed_at TIMESTAMPTZ
  );

CREATE INDEX idx_outbox_pending ON outbox_events (created_at)
WHERE
  status = 0;

CREATE TABLE
  audit_logs (
    id BIGINT PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_id BIGINT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW ()
  );