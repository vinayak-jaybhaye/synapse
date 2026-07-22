# Gateway Service Overview

The Gateway Service (`apps/gateway`) is a stateless, event-driven WebSocket server. It serves as the real-time communication pipeline between client applications (web/mobile) and the Synapse backend infrastructure.

## Core Responsibilities
1. **WebSocket Termination**: Handles connection upgrades, session authentication, and WebSocket framing.
2. **Real-Time Presence**: Tracks multi-device user online/offline status using Redis.
3. **In-Memory Routing**: Maintains local hash maps of connected clients to fan out events instantly.
4. **Dynamic Permissions**: Computes effective channel permissions and dynamically adjusts WebSocket subscriptions on the fly.
5. **Event Interception**: Bridges API events (published by HTTP backend services) via Redis Pub/Sub to WebSocket clients.

## Startup Sequence & Execution Flow
The active entry point for the Gateway service is `cmd/server/main.go`. The startup sequence proceeds as follows:

1. **Configuration Loading**: Loads environment variables via `internal/config/config.go`. The service will fail-fast (`log.Fatalf`) and exit if required variables are missing.
2. **Store Initialization**: Connects to the Redis cluster and the PostgreSQL database.
3. **Hub Initialization**: Instantiates the central connection `Hub` and launches its event loop in a background goroutine (`go hub.Run()`).
4. **Subscriber Initialization**: Instantiates the Redis `Subscriber` and launches its event loop (`go sub.Run(ctx)`).
5. **HTTP Server**: Registers the `/ws` endpoint for WebSocket upgrades and `/health` for readiness probes, then starts listening on the configured port.

## Stateless Design
The Gateway is designed to be horizontally scalable. It does not persist historical messages, channel state, or user profiles. Its internal memory is entirely dedicated to routing tables (`Hub` maps), rate limiters, and socket buffers for its currently active connections. If a Gateway node crashes, no permanent state is lost.

## Directory Structure
- `cmd/server/`: The active entry point for the service.
- `internal/auth/`: Session token verification and device state validation.
- `internal/config/`: Strict environment variable loading.
- `internal/presence/`: Redis Lua-script based presence tracking.
- `internal/pubsub/`: Redis Pub/Sub interception and bridging.
- `internal/websocket/`: WebSocket framing, `Hub` routing, and bitwise permission evaluation.

## Related Documentation
- [WebSocket Lifecycle & Connections](websocket-lifecycle.md)
- [Hub In-Memory Routing](hub-routing.md)
- [Permissions Engine](permissions-engine.md)
- [Pub/Sub Interceptor](pubsub-interceptor.md)
- [Presence Tracking](presence.md)
