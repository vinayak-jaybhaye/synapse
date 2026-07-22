# Relay Service Overview

The Relay Service (`apps/relay`) acts as a dedicated background worker implementing the **Transactional Outbox Pattern**. It ensures guaranteed, at-least-once delivery of real-time events from the backend database to the WebSocket Gateway.

## Architectural Role

When the REST API performs a state mutation (e.g., creating a message, updating a role), it writes both the domain entity and an `outbox_events` record to PostgreSQL within the exact same SQL transaction. This guarantees that if the mutation succeeds, the event is durably recorded.

The Relay Service is responsible for:
1. Detecting new events in the `outbox_events` table.
2. Packaging those events into a JSON envelope.
3. Publishing the envelope to the Redis Pub/Sub cluster (where the Gateway is listening).
4. Marking the event as processed (or dead-lettering it on failure).

This architecture decouples the API service from Redis, preventing a Redis outage from causing API downtime or dropping events.

## Startup Sequence

The entry point for the service is `cmd/server/main.go`.

1. **Configuration**: Loads variables via `internal/config/config.go`.
2. **Infrastructure Connections**: Establishes persistent connections to both PostgreSQL and Redis.
3. **Worker Initialization**: Determines how many workers to spawn based on the partitioning configuration (`cfg.WorkerCount` or `WORKER_PARTITION` env var).
4. **Execution**: Spawns the required `worker.Worker` instances as concurrent goroutines and waits via a `sync.WaitGroup` until interrupted.
5. **Graceful Shutdown**: Catches `SIGTERM`/`SIGINT`, signals the workers' `context.Context` to cancel, and awaits completion.

## Directory Structure
- `cmd/server/`: Service entry point and worker orchestration.
- `internal/config/`: Environment loading configuration.
- `internal/worker/`: The core outbox polling, listener setup, and publishing logic.

## Related Documentation
- [Worker Lifecycle](worker-lifecycle.md)
- [Batch Processing & Error Handling](batch-processing.md)
- [Partitioning and Scaling](partitioning.md)
