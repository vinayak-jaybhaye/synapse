# Database & Repositories

The API relies on PostgreSQL as its primary source of truth and Redis for ephemeral state. All database interactions are abstracted behind the Repository pattern.

## Connection Management (`internal/database`)

The API establishes connections to both databases during startup in `cmd/server/main.go`.

- **PostgreSQL (`database/sql` & `lib/pq`)**: The database pool is explicitly configured for high concurrency:
  - `SetMaxOpenConns(25)`
  - `SetMaxIdleConns(25)`
  - `SetConnMaxLifetime(5 * time.Minute)`
- **Redis (`redis/go-redis`)**: Used for caching, typing indicators, and communicating with the Gateway.

## The Repository Pattern

To keep business logic pure, the Service layer never executes raw SQL. Instead, each domain defines a `Repository` interface in `internal/<domain>/repository.go`.

```go
type Repository interface {
    CreateMessage(ctx context.Context, msg *Message) error
    GetMessage(ctx context.Context, id int64) (*Message, error)
}
```

A concrete `PGRepository` struct implements this interface. This design isolates the SQL driver and makes it trivially easy to mock the database during unit testing by injecting a mock repository into the Service layer.

## Snowflake IDs (`internal/snowflake`)

Unlike traditional REST APIs that use auto-incrementing integers or UUIDs, Synapse uses **Snowflake IDs** (originally created by Twitter) for almost all primary keys (Users, Messages, Guilds, Channels).

A Snowflake is a 64-bit integer that guarantees global uniqueness without needing a centralized database sequence. It contains:
- **Timestamp**: (41 bits) Milliseconds since a custom epoch, ensuring IDs are chronologically sortable.
- **Node ID**: (10 bits) Uniquely identifies the API instance generating the ID. (Set via the `NODE_ID` env variable in configuration).
- **Sequence Number**: (12 bits) Increments for every ID generated within the exact same millisecond.

### Why Snowflakes?
1. **Sortable by Time**: Clients can sort messages and objects perfectly without needing a separate `created_at` timestamp.
2. **Decentralized Generation**: The API generates the ID (`snowflake.GenerateID()`) *before* inserting it into PostgreSQL, avoiding round-trip delays to fetch the primary key.
3. **Cursor Pagination**: Because they are chronologically sortable integers, Snowflakes are perfect for highly efficient cursor-based pagination (e.g., `GET /messages?before=123456789`), entirely eliminating the performance issues of `OFFSET` pagination on large tables.
