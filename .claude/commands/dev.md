# Start Development Environment

Start all services (Node.js servers + PocketBase) in Docker for local development.

## Start All Services

```bash
docker compose up --build -d && sleep 3 && docker compose logs --tail=20 && URL=$(docker compose logs 2>/dev/null | grep -o 'http://0.0.0.0:8090/_/#/pbinstal/[^[:space:]]*' | tail -1 | sed 's/0.0.0.0/localhost/') && [ -n "$URL" ] && echo "$URL" | pbcopy && echo "" && echo "✓ PocketBase installer URL copied to clipboard (Cmd+V to paste)" || true
```

Starts services, shows logs, and copies the PocketBase installer URL to clipboard (only on first run).

## View Logs

```bash
docker compose logs -f
```

## Services

| Service | URL |
|---------|-----|
| Homepage | http://localhost:3000 |
| Web App | http://localhost:3001 |
| Admin Dashboard | http://localhost:3002 |
| PocketBase API | http://localhost:8090 |
| PocketBase Admin | http://localhost:8090/_/ |

## Hot Reload

- **Static files**: Immediate
- **Server code**: Auto-restart via `--watch`
- **PocketBase hooks**: Requires container restart
