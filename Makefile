.PHONY: web api gateway db-up db-down

db-up:
	docker-compose up -d postgres redis

db-down:
	docker-compose down

api:
	cd apps/api && go run cmd/server/main.go

gateway:
	cd apps/gateway && go run cmd/gateway/main.go

web:
	cd apps/web && npm run dev
