# Manual Deployment

This project can be deployed anywhere Docker runs.

## Build & Test Locally

```bash
# Build production image
docker build -t myapp .

# Test locally
docker run -p 3000:3000 -p 3001:3001 -p 3002:3002 -p 8090:8090 myapp
```

## Deployment Options

### Option 1: Any Docker Host (VPS, Dedicated Server)

```bash
# On your server
git pull
docker build -t myapp .
docker stop myapp || true
docker run -d --name myapp --restart unless-stopped \
  -p 3000:3000 -p 3001:3001 -p 3002:3002 -p 8090:8090 \
  -v pb_data:/app/api/pb_data \
  myapp
```

### Option 2: PaaS Platforms (Coolify, Railway, Render, Fly.io)

1. Connect your GitHub repository
2. Point to the root `Dockerfile`
3. Configure domains for each port
4. Push to deploy

## Service Ports

| Service | Port | Domain Example |
|---------|------|----------------|
| Homepage | 3000 | example.com |
| Web App | 3001 | app.example.com |
| Admin Dashboard | 3002 | admin.example.com |
| PocketBase | 8090 | api.example.com |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `API_URL` | Your production PocketBase URL |
| `HOMEPAGE_PORT` | `3000` (default) |
| `WEBAPP_PORT` | `3001` or empty for path-based |
| `ADMIN_PORT` | `3002` or empty for path-based |

## GitHub Actions

Check deployment workflow status:
```bash
gh run list --workflow=deploy.yml --limit=5
```
