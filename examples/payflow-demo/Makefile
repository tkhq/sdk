.PHONY: help install demo verify clean typecheck build test

# Default target
.DEFAULT_GOAL := help

# Variables
DEMO_DIR := $(shell pwd)
NODE_MODULES := node_modules
PNPM := pnpm

help: ## Show this help message
	@echo "Payflow Demo - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

install: ## Install dependencies
	@echo "Installing dependencies..."
	@$(PNPM) install

demo: ## Run the interactive demo (skips build-all)
	@echo "Starting Payflow Interactive Demo..."
	@$(PNPM) exec tsx src/index.ts

demo-full: ## Run the demo with full build (build-all)
	@echo "Starting Payflow Demo (with full build)..."
	@$(PNPM) demo:build

verify: ## Verify a transaction (requires TRANSACTION_HASH in .env.local)
	@echo "Verifying transaction..."
	@$(PNPM) verify

typecheck: ## Run TypeScript type checking
	@echo "Running TypeScript type check..."
	@$(PNPM) typecheck

clean: ## Clean build artifacts and cache
	@echo "Cleaning build artifacts..."
	@$(PNPM) clean

build: ## Build the project (if needed)
	@echo "Building project..."
	@$(PNPM) -w run build-all

test: ## Run tests (if any)
	@echo "Running tests..."
	@echo "No tests configured yet"

setup: install ## Setup the project (install dependencies)
	@echo "Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy .env.local.example to .env.local (if it exists)"
	@echo "  2. Configure your environment variables in .env.local"
	@echo "  3. Run 'make demo' to start the interactive CLI"

check-env: ## Check if required environment variables are set
	@echo "Checking environment variables..."
	@if [ ! -f .env.local ]; then \
		echo ".env.local file not found!"; \
		echo "   Please create .env.local with required variables:"; \
		echo "   - API_PUBLIC_KEY"; \
		echo "   - API_PRIVATE_KEY"; \
		echo "   - ORGANIZATION_ID"; \
		exit 1; \
	fi
	@echo ".env.local file found"
	@if ! grep -q "API_PUBLIC_KEY" .env.local || ! grep -q "API_PRIVATE_KEY" .env.local || ! grep -q "ORGANIZATION_ID" .env.local; then \
		echo "Warning: Some required variables may be missing"; \
	else \
		echo "Required environment variables appear to be set"; \
	fi

lint: ## Run linter (if configured)
	@echo "Running linter..."
	@echo "No linter configured yet"

format: ## Format code (if configured)
	@echo "Formatting code..."
	@echo "No formatter configured yet"

dev: demo ## Alias for demo command

run: demo ## Alias for demo command

