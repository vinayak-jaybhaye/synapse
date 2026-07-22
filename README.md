# Synapse

Synapse is a scalable real-time communication platform supporting authentication, guilds, channels, messaging, and presence.

## Features

- **Guilds & Channels** — Create servers with text and voice channels, manage members and invites
- **Messaging** — Real-time chat with message history, edits, deletes, and emoji reactions
- **Voice & Video** — Voice channel joining/leaving via [LiveKit](https://livekit.io/) WebRTC, with moderator mute/deafen/disconnect controls
- **Roles & Permissions** — Bitwise permission system with guild-level roles and per-channel overrides
- **Real-Time Presence** — Multi-device online/offline tracking via Redis Sorted Sets with graceful offline detection
- **Direct Messages** — 1-to-1 DM conversations
- **Media Uploads** — File and image uploads via S3-compatible storage (LocalStack in dev)
- **Audit Logs** — Administrative action history per guild
- **User Blocking** — Block and unblock other users

## Architecture

| Service | Stack | Role |
| :--- | :--- | :--- |
| `api` | Go, Gin | REST API for all state mutations and historical reads |
| `gateway` | Go, Gorilla WebSocket | WebSocket server for real-time event fan-out |
| `relay` | Go | Outbox worker — bridges PostgreSQL events to Redis Pub/Sub |
| `web` | Next.js | Web client |
| PostgreSQL | — | Primary datastore |
| Redis | — | Pub/Sub and presence tracking |
| LocalStack (S3) | — | File storage (media uploads) |

## Folder Structure
- `apps/api/` — Go REST API
- `apps/gateway/` — Go WebSocket Gateway
- `apps/relay/` — Go Outbox Relay worker
- `apps/web/` — Next.js web application
- `docs/` — Architecture and service documentation

## Development Workflow

**1. Start infrastructure** (PostgreSQL, Redis, LocalStack):
```sh
make db-up
```

**2. Run migrations:**
```sh
make db-migrate
```

**3. Run all services concurrently:**
```sh
make dev
```

Or run each service individually:
```sh
make api       # REST API
make gateway   # WebSocket Gateway
make relay     # Outbox Relay
make web       # Next.js web client
```

## Other Commands
```sh
make fmt        # Format all Go and web code
make lint       # Lint all Go and web code
make test       # Run all tests
```
