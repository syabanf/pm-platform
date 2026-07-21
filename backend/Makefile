SHELL := /bin/bash
-include .env
export

DB_URL ?= $(DATABASE_URL)
MIGRATIONS := migrations

.PHONY: help up down migrate-up migrate-down migrate-force new-migration sqlc run build test tidy fmt vet check

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start local Postgres (docker compose)
	docker compose up -d

down: ## Stop local Postgres
	docker compose down

migrate-up: ## Apply all migrations
	migrate -path $(MIGRATIONS) -database "$(DB_URL)" up

migrate-down: ## Roll back the last migration
	migrate -path $(MIGRATIONS) -database "$(DB_URL)" down 1

migrate-force: ## Clear a dirty migration state: make migrate-force V=1
	migrate -path $(MIGRATIONS) -database "$(DB_URL)" force $(V)

new-migration: ## Scaffold a migration: make new-migration NAME=add_widgets
	migrate create -ext sql -dir $(MIGRATIONS) -seq $(NAME)

sqlc: ## Regenerate type-safe query code from migrations + queries
	sqlc generate

run: ## Run the API
	go run ./cmd/api

build: ## Compile the API binary into bin/api
	go build -o bin/api ./cmd/api

test: ## Run tests
	go test ./...

tidy: ## Sync go.mod/go.sum
	go mod tidy

fmt: ## Format
	go fmt ./...

vet: ## Vet
	go vet ./...

check: fmt vet test ## Format, vet and test
