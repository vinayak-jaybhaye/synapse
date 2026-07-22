# Domain Modules

The API codebase does not organize files by technical layers (e.g., all controllers in one folder, all models in another). Instead, it uses **Domain-Driven Directory Structure**. Each folder inside `internal/` encapsulates a specific business feature.

## Core Domains

The primary domains include:
- `auth`: Opaque token issuance, device tracking, and session validation.
- `users`: User profiles, avatars, and settings.
- `guilds`: Server creation, metadata, and member management.
- `channels`: Text, voice, and category channel management.
- `messages`: Chat message CRUD, reactions, and read states.
- `roles`: Guild roles and hierarchy.
- `permissions`: Role assignments and channel overrides.
- `voice`: LiveKit room token generation and WebRTC signaling.
- `media`: AWS S3 interactions and presigned URLs.
- `audit`: Guild audit logs tracking administrative actions.
- `blocks`: User blocking logic.
- `notifications`: Push notification settings and fetching.

## Standard Domain File Structure

Inside a typical domain (e.g., `internal/messages/`), you will find exactly four files:

### 1. `model.go` (or `dto.go`)
Defines the core data structures (Structs), database mapping tags, and Data Transfer Objects (DTOs) for incoming requests and outgoing responses.
*Example: `CreateMessageRequest`, `MessageResponse`*

### 2. `repository.go`
Defines an interface for database interactions and its PostgreSQL implementation. It is purely responsible for executing SQL queries (`database/sql`) and returning domain models.
*Example: `repo.CreateMessage(...)` -> Executes `INSERT INTO messages...`*

### 3. `service.go`
Defines the business logic interface. It coordinates between repositories, handles authorization, performs data validation, and fires events. 
*Example: `service.SendMessage(...)` -> Validates permissions -> Calls `repo.CreateMessage` -> Calls `eventBus.Publish`*

### 4. `handler.go`
The HTTP transport layer. It takes a Gin HTTP context (`*gin.Context`), extracts variables from the URL or JSON body, calls the `Service`, and serializes the result back to the client as JSON.

## Cross-Domain Communication

Because domains are strictly isolated, they cannot directly query each other's databases. Instead, they communicate by passing their `Service` interfaces.

For example, when creating a message, the `messages.Service` needs to verify the user has the `SEND_MESSAGES` permission. It does this because `permissions.Service` was injected into the `messages.Service` struct during bootstrapping in `main.go`. This prevents cyclic dependencies and keeps the code decoupled.
