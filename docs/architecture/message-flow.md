# Message Flow
1. User posts a message to REST API `POST /api/channels/:id/messages`.
2. App stores in Postgres.
3. App publishes event to Redis.
4. Gateway subscribes to Redis channel.
5. Gateway pushes message over WS to subscribed clients.
