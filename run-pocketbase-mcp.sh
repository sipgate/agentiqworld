#!/bin/sh
# Load .env and run pocketbase-mcp
set -a && . ./.env 2>/dev/null && set +a
exec npx -y pocketbase-mcp
