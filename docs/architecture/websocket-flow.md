# WebSocket Flow
1. Client connects with JWT token `/ws?token=...`.
2. Gateway validates token and registers connection.
3. Client sends `SUBSCRIBE_CHANNEL` payload.
4. Gateway subscribes client to internal channel topic.
5. Incoming messages to gateway are fanned out to connected clients.
