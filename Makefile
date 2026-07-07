.PHONY: web api gateway db-up db-down

db-up:
	docker-compose up -d postgres redis localstack

localstack-init:
	./localstack-init.sh

db-down:
	docker-compose down

api:
	cd apps/api && go run cmd/server/main.go

gateway:
	cd apps/gateway && go run cmd/server/main.go

relay:
	cd apps/relay && go run cmd/server/main.go

web:
	cd apps/web && pnpm run dev

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
