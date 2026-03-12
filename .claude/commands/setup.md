# Initial Project Setup

Run this after cloning the boilerplate to configure a new project.

## 1. Check Development Environment

If you used the install script, your containers are already running. Verify with:

```bash
docker compose ps
```

**If not running**, start with:

```bash
cp .env.example .env
docker compose up --build
```

## 2. Set Up MCP Credentials (if not done by install script)

The install script automatically saves `POCKETBASE_ADMIN_TOKEN` to your project's `.env` file. Claude Code auto-loads `.env` on startup.

**To manually generate a PocketBase token:**
1. Go to http://localhost:8090/_/
2. Login with your admin credentials
3. Click your profile → "Manage API keys"
4. Create a new API key and add to `.env`:
   ```bash
   POCKETBASE_ADMIN_TOKEN="your-token"
   ```

**GitHub MCP** (optional) - add to `~/.zshrc` since it's global:
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_xxx"  # https://github.com/settings/tokens
```

## 3. Update Project Name

Replace placeholders in:
- `CLAUDE.md` - Update [PROJECT_NAME] and description
- `README.md` - Update project name
- `homepage/index.html` - Update title and content
- `LICENSE` - Update year and author

## 4. Verify Everything Works

Services should be available at:
- Homepage: http://localhost:3000
- Web App: http://localhost:3001
- Admin: http://localhost:3002
- PocketBase Admin: http://localhost:8090/_/
