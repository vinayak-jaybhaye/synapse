# Permissions Engine

The Gateway evaluates permissions dynamically to ensure users are instantly disconnected from channels they lose access to. This logic lives in `internal/websocket/permissions.go`.

## Bitwise Evaluation Hierarchy

Synapse uses a standard Discord-style bitwise permission system. Every permission (e.g., `VIEW_CHANNEL`, `SEND_MESSAGES`) is represented as a single bit in a 64-bit integer.

The Gateway computes the "effective permissions" for a user in a specific channel using the following hierarchy:

1. **Base Guild Owner** (Batch resolution only): If the user owns the guild, they automatically receive the `ADMINISTRATOR` flag. The single-user `ResolveChannelAccess` function does not implement this owner fast-path.
2. **Base Guild Roles**: Combine the bitmasks of all roles the user holds in the guild (including the default `@everyone` role).
3. **Administrator Wildcard**: If the combined base roles include the `ADMINISTRATOR` flag (bit 3), the evaluation stops. The user has total access to all channels, overriding any specific channel denials.
4. **Channel Overrides (Role-only)**: If the user is not an Administrator, the engine evaluates channel-specific role overrides in this exact order:
   - Apply `DENY` flags from the default (`@everyone`) role override.
   - Apply `ALLOW` flags from the default (`@everyone`) role override.
   - Apply `DENY` flags aggregated across all other custom roles the user holds.
   - Apply `ALLOW` flags aggregated across all other custom roles the user holds.

*Note: Allow flags always take precedence over Deny flags at the same level. Synapse currently only implements Role-based overrides, not user-specific overrides.*

## Batch Resolution (`ResolveChannelAccessBatch`)

When a role is updated globally (`GUILD_ROLE_UPDATE`), the Gateway must determine if any connected users lost access to any restricted channels. 

Doing a full SQL evaluation for every connected user independently would overwhelm PostgreSQL. Instead, `ResolveChannelAccessBatch` groups users using the PostgreSQL `ANY(...)` array operator.

The implementation performs the following SQL queries (issued as separate decoupled operations):
1. **Guild ID Resolution**: Identifies the guild for the channel, or falls back to DM verification.
2. **Membership Verification**: Confirms which users in the batch are actually members of the guild (`guild_members`).
3. **Default Role Fetch**: Retrieves the base permissions and ID for the `@everyone` role.
4. **Custom Roles Fetch**: Fetches custom role assignments and permissions for the entire batch in one query using `ANY($2)`.
5. **Channel Overrides**: Fetches the `channel_role_permissions` for the target channel.
6. **Owner Resolution**: Fetches the guild `owner_id`.

The engine then runs the bitwise hierarchy purely in Go memory for the entire batch.

## Interception Logic

This engine is hooked directly into the `Hub`. When the Redis Subscriber intercepts a `CHANNEL_PERMISSIONS_UPDATE` event, it calls the `Hub.HandleChannelPermissionsUpdate` method.
The Hub uses the Permission Engine to evaluate every connected client in that channel. If a client's effective permissions no longer contain `VIEW_CHANNEL`, the Hub silently evicts them from the `h.channelClients` map and pushes a synthetic `CHANNEL_DELETE` event to their socket to remove the channel from their UI.
