SHELL := /bin/bash
-include .env
export

DB_URL ?= $(DATABASE_URL)
MIGRATIONS := migrations

.PHONY: help up down migrate-up migrate-down migrate-force new-migration sqlc seed run build test tidy fmt vet check

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

# Volumes are overridable: make seed SEED_CLIENTS=1000 SEED_TASKS_PER=40
SEED_CLIENTS    ?= 200
SEED_PROJECTS   ?= 4
SEED_PRODUCTS   ?= 3
SEED_COMPONENTS ?= 4
SEED_SPRINTS    ?= 10
SEED_BACKLOG    ?= 30
SEED_TASKS_PER  ?= 20
SEED_MEMBERS    ?= 2000

seed: ## Fill the database with a realistic portfolio (~1.2M rows by default)
	psql "$(DB_URL)" -q \
		-v clients=$(SEED_CLIENTS) \
		-v projects_per=$(SEED_PROJECTS) \
		-v products_per=$(SEED_PRODUCTS) \
		-v components_per=$(SEED_COMPONENTS) \
		-v sprints_per=$(SEED_SPRINTS) \
		-v backlog_per=$(SEED_BACKLOG) \
		-v tasks_per=$(SEED_TASKS_PER) \
		-v members=$(SEED_MEMBERS) \
		-f seed/seed.sql

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
