.PHONY: help web api gateway dev db-up db-down db-migrate reset-db

.DEFAULT_GOAL := help

help:
	@echo "Available commands:"
	@echo "  help            - Show this help message"
	@echo "  db-up           - Start infrastructure (postgres, redis, localstack)"
	@echo "  db-down         - Stop infrastructure"
	@echo "  db-down-data    - Stop infrastructure and remove data volumes"
	@echo "  db-migrate      - Run database migrations"
	@echo "  reset-db        - Reset database (WARNING: deletes all data)"
	@echo "  localstack-init - Initialize localstack"
	@echo "  dev             - Run API, Gateway, Relay, and Web concurrently"
	@echo "  api             - Run API server"
	@echo "  gateway         - Run Gateway server"
	@echo "  relay           - Run Relay server"
	@echo "  web             - Run Web client"
	@echo "  fmt             - Format code"
	@echo "  lint            - Lint code"
	@echo "  test            - Run tests"

db-up:
	docker-compose up -d postgres redis localstack
	@echo "Waiting for localstack to be ready..."
	@sleep 5
	$(MAKE) localstack-init

localstack-init:
	./localstack-init.sh

db-down:
	docker-compose down

db-down-data:
	docker-compose down -v

db-migrate:
	@echo "Running migrations with goose..."
	cd apps/api && go run github.com/pressly/goose/v3/cmd/goose@latest -dir migrations postgres "postgres://postgres:postgres@localhost:5432/synapse?sslmode=disable" up

reset-db:
	docker-compose down -v
	$(MAKE) db-up
	@echo "Waiting for database to be ready..."
	@sleep 5
	$(MAKE) db-migrate

api:
	cd apps/api && go run cmd/server/main.go

gateway:
	cd apps/gateway && go run cmd/server/main.go

relay:
	cd apps/relay && go run cmd/server/main.go

web:
	cd apps/web && pnpm run dev

dev:
	$(MAKE) -j4 api gateway relay web

# Formatting
fmt: fmt-go fmt-web

fmt-go:
	cd apps/api && go fmt ./...
	cd apps/gateway && go fmt ./...
	cd apps/relay && go fmt ./...

fmt-web:
	cd apps/web && pnpm run format

# Linting
lint: lint-go lint-web

lint-go:
	cd apps/api && go vet ./...
	cd apps/gateway && go vet ./...
	cd apps/relay && go vet ./...

lint-web:
	cd apps/web && pnpm run lint

# Testing
test: test-go

test-go:
	cd apps/api && go test ./...
	cd apps/gateway && go test ./...
	cd apps/relay && go test ./...
