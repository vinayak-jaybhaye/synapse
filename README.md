# Synapse

Synapse is a scalable realtime communication platform supporting authentication, guilds, channels, messaging, and presence.

## Architecture Request
- **web**: Next.js frontend
- **api**: Go REST API service
- **gateway**: Go WebSocket Gateway service
- **postgres**: Primary datastore
- **redis**: Cache and pub/sub

## Folder Structure
- `apps/api`: Go REST API for entity management
- `apps/gateway`: Go WebSocket Gateway
- `apps/web`: Next.js web application
- `packages/`: Shared packages
- `infrastructure/`: Infrastructure definitions
- `docs/`: Documentation

## Development Workflow
1. Start infrastructure: `make db-up`
2. Run API: `make api`
3. Run Gateway: `make gateway`
4. Run Web: `make web`
