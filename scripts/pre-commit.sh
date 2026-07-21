#!/usr/bin/env bash
set -e

# Change to repository root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "========================================"
echo "      Running Pre-Commit Checks         "
echo "========================================"

# 1. Format Code (Go + Prettier)
echo "==> [1/5] Formatting code (Go & Web)..."
make fmt

# Re-stage formatted files if they are in the git index
STAGED_FILES=$(git diff --cached --name-only)
if [ -n "$STAGED_FILES" ]; then
    echo "==> Re-staging formatted files..."
    for file in $STAGED_FILES; do
        if [ -f "$file" ]; then
            git add "$file"
        fi
    done
fi

# 2. Check for Merge Conflict Markers
echo "==> [2/5] Checking for merge conflict markers..."
if git diff --cached | grep -E '^(<{7}|={7}|>{7})' > /dev/null 2>&1; then
    echo "❌ Error: Unresolved merge conflict markers detected in staged files."
    exit 1
fi

# 3. Lint Code (go vet + eslint)
echo "==> [3/5] Running linters (go vet & eslint)..."
make lint

# 4. Typecheck Web Application
echo "==> [4/5] Running TypeScript check (tsc --noEmit)..."
(cd apps/web && pnpm exec tsc --noEmit)

# 5. Run Unit Tests
echo "==> [5/5] Running unit tests..."
make test

echo "========================================"
echo "    ✓ All pre-commit checks passed!     "
echo "========================================"
