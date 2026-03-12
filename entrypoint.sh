#!/bin/sh
set -e

# Unified entrypoint script
# Starts PocketBase and Node.js servers
# In development mode (NODE_ENV=development), enables --watch for hot-reload

# Store PIDs for cleanup
POCKETBASE_PID=""
NODE_PID=""

# Graceful shutdown handler
cleanup() {
    echo "Shutting down..."

    if [ -n "$NODE_PID" ] && kill -0 "$NODE_PID" 2>/dev/null; then
        echo "Stopping Node.js servers..."
        kill -TERM "$NODE_PID" 2>/dev/null || true
        wait "$NODE_PID" 2>/dev/null || true
    fi

    if [ -n "$POCKETBASE_PID" ] && kill -0 "$POCKETBASE_PID" 2>/dev/null; then
        echo "Stopping PocketBase..."
        kill -TERM "$POCKETBASE_PID" 2>/dev/null || true
        wait "$POCKETBASE_PID" 2>/dev/null || true
    fi

    echo "Shutdown complete"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Determine if we're in development mode
IS_DEV=false
if [ "${NODE_ENV}" = "development" ]; then
    IS_DEV=true
fi

# Start PocketBase in background
if [ "$IS_DEV" = true ]; then
    echo "Starting PocketBase (development mode)..."
else
    echo "Starting PocketBase..."
fi
/pb/pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data --hooksDir=/pb/pb_hooks --migrationsDir=/pb/pb_migrations &
POCKETBASE_PID=$!

# Wait for PocketBase to be ready
echo "Waiting for PocketBase to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until wget -q --spider http://localhost:8090/api/health 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "ERROR: PocketBase failed to start after $MAX_RETRIES attempts"
        exit 1
    fi
    echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - PocketBase not ready yet..."
    sleep 1
done

echo "PocketBase is ready!"

# Create superuser from env vars if set (for automated deployments like Coolify).
# NOTE: CLAUDE.md says "NEVER run pocketbase superuser commands" — that rule applies to
# Claude (the AI assistant), not to this entrypoint. This block is for headless deployment
# platforms where the admin UI isn't available during setup.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
    echo "Creating/updating PocketBase superuser..."
    /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb/pb_data 2>&1 || echo "WARNING: Failed to create superuser"
fi

# Start Node.js servers (with --watch in development mode)
if [ "$IS_DEV" = true ]; then
    echo "Starting Node.js servers (watch mode for hot-reload)..."
    cd /app/server && node --watch index.js &
else
    echo "Starting Node.js servers..."
    cd /app/server && node index.js &
fi
NODE_PID=$!

# Print service URLs
echo ""
if [ "$IS_DEV" = true ]; then
    echo "========================================"
    echo "  Development servers started!"
    echo "========================================"
else
    echo "All services started:"
fi
echo ""
# Use HOST_*_PORT for display (external/host ports), fall back to internal ports
DISPLAY_HOMEPAGE=${HOST_HOMEPAGE_PORT:-${HOMEPAGE_PORT:-3000}}
DISPLAY_WEBAPP=${HOST_WEBAPP_PORT:-${WEBAPP_PORT:-3001}}
DISPLAY_ADMIN=${HOST_ADMIN_PORT:-${ADMIN_PORT:-3002}}
DISPLAY_PB=${HOST_POCKETBASE_PORT:-${POCKETBASE_PORT:-8090}}

echo "  Homepage:    http://localhost:${DISPLAY_HOMEPAGE}"
if [ -n "${WEBAPP_PORT}" ]; then
    echo "  Webapp:      http://localhost:${DISPLAY_WEBAPP}"
else
    echo "  Webapp:      http://localhost:${DISPLAY_HOMEPAGE}${WEBAPP_PATH:-/}"
fi
if [ -n "${ADMIN_PORT}" ]; then
    echo "  Admin:       http://localhost:${DISPLAY_ADMIN}"
else
    echo "  Admin:       http://localhost:${DISPLAY_HOMEPAGE}${ADMIN_PATH:-/admin}"
fi
echo "  PocketBase:  http://localhost:${DISPLAY_PB}"
echo "  PB Admin:    http://localhost:${DISPLAY_PB}/_/"
echo ""

if [ "$IS_DEV" = true ]; then
    echo "Hot-reload enabled - changes to server/*.js will auto-restart"
    echo ""
    echo "NOTE: First time? Check the logs above for the PocketBase"
    echo "      installer URL to create your admin account."
    echo ""
fi

# Wait for any process to exit
wait -n $POCKETBASE_PID $NODE_PID

# If we get here, a process exited unexpectedly
echo "A service exited unexpectedly, shutting down..."
cleanup
