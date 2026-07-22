# WebSocket Flow
1. Client establishes a standard WebSocket connection to `/ws`.
2. Client sends an `IDENTIFY` JSON payload containing their Opaque session token.
3. Gateway validates the token against the PostgreSQL `sessions` table.
4. Gateway queries PostgreSQL for all channels and guilds the user has access to.
5. Gateway registers the connection in the in-memory `Hub` and dynamically subscribes the client to internal pub/sub topics for those authorized channels.
6. Gateway sends a `READY` payload back to the client.
7. Real-time events received by the Gateway from the Relay via Redis are fanned out directly to authorized clients.

```mermaid
sequenceDiagram
    actor Client
    participant Gateway as WebSocket Gateway
    participant Hub as In-Memory Hub
    participant PG as PostgreSQL
    participant Redis as Redis Pub/Sub

    Client->>Gateway: WebSocket Upgrade (/ws)
    Gateway-->>Client: Connection Established
    
    Client->>Gateway: IDENTIFY { token: "opaque_token" }
    
    Gateway->>PG: SELECT * FROM sessions WHERE token = $1
    PG-->>Gateway: Session Valid (User ID: 123)
    
    Gateway->>PG: ResolveChannelAccessBatch(User ID: 123)
    PG-->>Gateway: Return authorized channels [101, 102]
    
    Gateway->>Hub: Register Client (UserID: 123, Channels: [101, 102])
    Hub-->>Gateway: Registration Success
    
    Gateway-->>Client: READY { user_id: 123, ... }
    
    loop Real-Time Fanout
        Redis->>Hub: Broadcast channel:101 Event
        Hub->>Gateway: Route to subscribed connections
        Gateway-->>Client: MESSAGE_CREATE payload
    end
```
