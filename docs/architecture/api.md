# Discord-Scale Backend Architecture & API Specification

## 1. Architectural Philosophy

To handle millions of concurrent connections and billions of daily events, the backend strictly adheres to these principles:

1. **Separation of State:** HTTP APIs are strictly for **State Mutation** (Writes) and **Historical Fetching** (Reads). WebSockets are strictly for **State Synchronization** (Real-time Fan-out).
2. **Immediate Acknowledgment:** The hottest paths (e.g., sending messages) must do the absolute minimum work required to achieve ACID compliance (insert to DB + Outbox) and return `201 Created`. All secondary side-effects are asynchronous.
3. **Transient State Avoidance:** High-frequency, low-value states (Typing indicators, Presence) **never** touch persistent storage or the REST API. They live entirely in memory/Redis.
4. **Cursor Only:** `OFFSET` pagination is strictly forbidden across the entire system.
5. **Lazy Loading over Mega-Payloads:** The initial WebSocket connection (`READY`) must be extremely lightweight. Clients lazy-load heavy relational data (guild members, channel histories) via REST APIs in the background.
6. **Eventual Ordering & Truth:** Real-time WebSocket delivery is best-effort and inherently unordered across distributed nodes. The REST API and Database remain the absolute source of truth. Clients must independently sort all incoming events (like messages) using their chronological Snowflake IDs to guarantee order.

---

## 2. Backend Modules & Responsibilities

The system is split into distinct services to allow independent scaling of read, write, and socket-holding workloads.

### A. API Gateway (Reverse Proxy)
* **Tech:** Envoy, NGINX, or Cloudflare Workers.
* **Role:** SSL termination, global rate-limiting, and routing. Validates the JWT signature before the request reaches an internal service, dropping unauthenticated traffic at the edge.

### B. Core API Service (Stateless Monolith / Microservices)
* **Role:** The workhorse for all HTTP CRUD operations.
* **Responsibilities:**
  * Enforcing database invariants (e.g., atomic `BEGIN; INSERT guild; INSERT role; INSERT member; COMMIT;`).
  * Writing messages and `outbox_events` within the exact same transaction boundary.

### C. Realtime State Service (Ephemeral State Store)
* **Tech:** Redis.
* **Role:** The centralized, highly available brain for all volatile user and network state.
* **Responsibilities:**
  * **Session Directory:** Manages multi-device concurrency. Maps `user_id` to all active sessions (e.g., `session:123 -> {"web_socket_id": "gateway-7", "mobile_socket_id": "gateway-12"}`).
  * **Channel Topology:** Maps `channel_id -> active_gateways` to optimize fanout routing.
  * **Presence & Voice:** Tracks who is currently online, idle, or actively connected to a voice node.

### D. Permission Cache Service
* **Tech:** Redis.
* **Role:** A dedicated layer to prevent re-evaluating complex Bitwise permissions on every request.
* **Responsibilities:**
  * Stores pre-computed permission resolutions: `perm:{user_id}:{guild_id}:{channel_id} -> 0xABCD1234`.
  * Listens for `ROLE_UPDATE` or `CHANNEL_UPDATE` events to intelligently invalidate the cached masks.

### E. The Outbox Relay & Fanout Router (Targeted Fanout)
* **Tech:** Go/Rust daemon + NATS/Kafka.
* **Role:** Bridges the synchronous DB commits to the asynchronous event-driven world.
* **Responsibilities:**
  * *Evolution:* Initially uses Redis Pub/Sub, but evolves to Kafka or NATS at massive scale.
  * **Optimized Gateway-Targeted Fanout:** To avoid O(N) Redis lookups for massive channels, this service queries the Realtime State Service for a `channel_id -> gateway_ownership` mapping. It groups target recipients and publishes exactly *one* payload per affected gateway. This ensures delivery to *all* active multi-device sessions for a user without flooding the broker.

### F. WebSocket Gateway (Stateful)
* **Tech:** Node.js, Go, Erlang/Elixir.
* **Role:** Holds millions of idle TCP connections open. Contains virtually zero business logic.
* **Responsibilities:**
  * Accepts the `IDENTIFY` payload on connection and registers the socket in the Session Directory.
  * Listens on a dedicated broker topic (e.g., `gateway-7-events`) for targeted fanout payloads.
  * **Presence Inference:** Automatically determines `ONLINE` or `OFFLINE` status via TCP/WebSocket keep-alive heartbeats, updating the Realtime State Service.
  * Passes transient events (`TYPING_START`) directly to the Fanout Router without hitting the Core API.

### G. Background Workers (Consumers)
* **Role:** Consumes from Kafka/Redis to execute heavy, delayed, or third-party logic.
* **Responsibilities:**
  * Sending Mobile Push Notifications (APNs/FCM).
  * Batch-flushing `channel_reads` from Redis HashMaps to the Postgres table every 2 minutes.

---

## 3. REST API Contract (State Mutation)

*Note: All IDs passed in URLs or payloads are Snowflake BIGINTs represented as Strings in JSON to prevent JavaScript precision loss.*

### User & Authentication
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Returns JWT and refresh token. |
| `GET` | `/api/v1/users/@me` | Returns current user profile. |
| `GET` | `/api/v1/users/@me/guilds` | Returns user's guild list. Unread counts injected dynamically from Redis. |
| `POST` | `/api/v1/dms` | Creates or returns existing DM. Body: `{ "recipient_id": "456" }`. |

### Guilds & Members
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/guilds` | Creates guild. Atomic transaction generates `@everyone` role and owner member. |
| `GET` | `/api/v1/guilds/:guildID` | Fetches guild metadata. |
| `GET` | `/api/v1/guilds/:guildID/members` | **Must use Cursor:** `?after=:userID&limit=50`. |
| `PATCH` | `/api/v1/guilds/:guildID/members/:userID` | Modifies member (nickname, mute status). |

### Roles & Permissions
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/guilds/:guildID/roles` | Lists roles. |
| `POST` | `/api/v1/guilds/:guildID/roles` | Creates a new role with bitmask. |
| `PATCH` | `/api/v1/guilds/:guildID/roles/:roleID` | Updates a role (name, color, bitmask). |
| `DELETE`| `/api/v1/guilds/:guildID/roles/:roleID` | Deletes a role. |
| `PUT` | `/api/v1/guilds/:guildID/members/:userID/roles/:roleID` | Assigns a role to a member. |

### Channels
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/guilds/:guildID/channels` | Fetches all channels for a guild to render the UI tree. |
| `POST` | `/api/v1/guilds/:guildID/channels` | Creates a new channel/category. |
| `PATCH` | `/api/v1/channels/:channelID` | Edits channel details (name, topic, position). |
| `DELETE`| `/api/v1/channels/:channelID` | Soft-deletes channel. |

### Messages & Interactions (The Hot Path)
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/channels/:channelID/messages` | **Must use Snowflake cursor:** `?before=:messageID&limit=50`. |
| `POST` | `/api/v1/channels/:channelID/messages` | Inserts DB + Outbox. Returns `201` immediately without waiting for workers. |
| `PATCH` | `/api/v1/channels/:channelID/messages/:messageID` | Updates message content and `edited_at`. |
| `DELETE`| `/api/v1/channels/:channelID/messages/:messageID` | Soft-deletes message. |
| `POST` | `/api/v1/channels/:channelID/read` | **Redis First:** Updates Redis Hash, returns `204`. Worker flushes to PG. |
| `PUT` | `/api/v1/channels/:channelID/messages/:messageID/reactions/:emoji` | Idempotent reaction add. |
| `DELETE`| `/api/v1/channels/:channelID/messages/:messageID/reactions/:emoji` | Idempotent reaction remove. |

### Invites
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/guilds/:guildID/invites` | Generates a new invite code. |
| `GET` | `/api/v1/invites/:code` | Previews invite metadata (Guild name, member count) before joining. |
| `POST` | `/api/v1/invites/:code/join` | Consumes invite and adds user to `guild_members`. |

---

## 4. WebSocket Contract (Real-Time Synchronization)

WebSockets are strictly for propagating state changes downstream.

### A. Client -> Gateway (Inbound)
* `IDENTIFY`: Initial handshake containing JWT. Registers socket in the Session Directory.
* `RESUME`: Reconnect using a sequence number if the connection drops briefly.
* `HEARTBEAT`: Sent periodically to keep the TCP connection alive. Gateway uses this to infer state.
* `PRESENCE_UPDATE`: Client explicitly sets a manual state (e.g., `IDLE`, `DND`, or "Playing X").
* `TYPING_START`: Sent every ~5 seconds while actively typing.
* `VOICE_STATE_UPDATE`: Client connects/disconnects from a voice channel.

### B. Gateway -> Client (Outbound / Fan-Out)

#### Connection & Identity
* `READY`: Minimal payload containing connection session ID and core user settings. Client lazy-loads the rest via REST.

#### Messaging
* `MESSAGE_CREATE`: A new message in a subscribed channel. *(Clients must sort incoming messages by Snowflake ID)*.
* `MESSAGE_UPDATE`: A message was edited.
* `MESSAGE_DELETE`: A message was deleted.
* `MESSAGE_REACTION_ADD`: Someone added an emoji.
* `MESSAGE_REACTION_REMOVE`: Someone removed an emoji.
* `TYPING_START`: Another user started typing in a viewed channel.
* `CHANNEL_READ_UPDATE`: System acknowledging the user's read state synced.

#### Structure & Moderation
* `CHANNEL_CREATE` / `CHANNEL_UPDATE` / `CHANNEL_DELETE`: Triggers UI hierarchy re-renders.
* `ROLE_CREATE` / `ROLE_UPDATE` / `ROLE_DELETE`: Propagates bitmask or cosmetic role changes.
* `GUILD_CREATE` / `GUILD_DELETE`: User was added to or removed from a guild.
* `GUILD_MEMBER_UPDATE`: Someone's role or nickname changed.
* `PRESENCE_UPDATE`: A friend or guild member's status changed. *(Note: At scale, presence fanout is batched or restricted to active viewports/friends to prevent event explosions).*