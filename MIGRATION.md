# Migration Guide

Use this guide to incrementally adopt the boilerplate structure in existing projects. Copy this file to your project and check off items as you migrate them.

## Prerequisites

Before migrating any project, ensure shared credentials are in your shell profile:

```bash
# Check if already set up
echo $GITHUB_PERSONAL_ACCESS_TOKEN
echo $COOLIFY_URL
```

If not set, see `.env.shared.example` from the boilerplate and add exports to `~/.zshrc`.

---

## Migration Checklist

### Phase 1: Foundation (No Risk)

These are additive changes that won't break anything.

- [ ] **CLAUDE.md** - Copy and customize for your project
  ```bash
  curl -o CLAUDE.md https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/CLAUDE.md
  ```

- [ ] **.editorconfig** - Consistent formatting
  ```bash
  curl -o .editorconfig https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.editorconfig
  ```

- [ ] **LICENSE** - If missing
  ```bash
  curl -o LICENSE https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/LICENSE
  ```

### Phase 2: Claude Code Integration (No Risk)

- [ ] **.claude/** directory - Commands and settings
  ```bash
  mkdir -p .claude/commands
  curl -o .claude/settings.json https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.claude/settings.json
  curl -o .claude/commands/dev.md https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.claude/commands/dev.md
  curl -o .claude/commands/stop.md https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.claude/commands/stop.md
  curl -o .claude/commands/db-status.md https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.claude/commands/db-status.md
  curl -o .claude/commands/deploy.md https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.claude/commands/deploy.md
  curl -o .claude/commands/commit.md https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.claude/commands/commit.md
  curl -o .claude/commands/setup.md https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.claude/commands/setup.md
  ```

- [ ] **.mcp.json** - MCP server configuration
  ```bash
  curl -o .mcp.json https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.mcp.json
  ```
  Uses env vars, safe to commit.

### Phase 3: Git Hygiene (Low Risk)

- [ ] **Update .gitignore** - Merge with boilerplate version
  ```bash
  curl -o .gitignore.new https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.gitignore
  # Compare and merge:
  diff .gitignore .gitignore.new
  ```

### Phase 4: Project Structure (Medium Risk)

Requires restructuring your project.

- [ ] **Create new directories**
  ```bash
  mkdir -p homepage/css homepage/js homepage/assets/images
  mkdir -p webapp/css webapp/js
  mkdir -p admin/css admin/js admin/components
  mkdir -p server
  mkdir -p api/pb_hooks api/pb_migrations
  ```

- [ ] **Move existing frontend** to `homepage/` or `webapp/`
  - Static/marketing pages → `homepage/`
  - App/authenticated pages → `webapp/`

- [ ] **Create server files**
  ```bash
  curl -o server/package.json https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/server/package.json
  curl -o server/index.js https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/server/index.js
  curl -o server/homepage.js https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/server/homepage.js
  curl -o server/webapp.js https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/server/webapp.js
  curl -o server/admin.js https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/server/admin.js
  ```

### Phase 5: Docker Setup (Medium Risk)

- [ ] **Dockerfile** - Production container
  ```bash
  curl -o Dockerfile https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/Dockerfile
  ```

- [ ] **Dockerfile.dev** - Development container
  ```bash
  curl -o Dockerfile.dev https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/Dockerfile.dev
  ```

- [ ] **docker-compose.yml** - Local development
  ```bash
  curl -o docker-compose.yml https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/docker-compose.yml
  ```

- [ ] **Entrypoint scripts**
  ```bash
  curl -o entrypoint.sh https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/entrypoint.sh
  curl -o entrypoint.dev.sh https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/entrypoint.dev.sh
  chmod +x entrypoint.sh entrypoint.dev.sh
  ```

### Phase 6: Environment Variables (Medium Risk)

- [ ] **Create .env.example** - Document required variables
  ```bash
  curl -o .env.example https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.env.example
  cp .env.example .env
  ```

- [ ] **Update .env.shared.example** - Shared credentials
  ```bash
  curl -o .env.shared.example https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.env.shared.example
  ```

### Phase 7: CI/CD (Higher Risk)

Test in a branch first!

- [ ] **.github/workflows/deploy.yml** - Unified deployment
  ```bash
  mkdir -p .github/workflows
  curl -o .github/workflows/deploy.yml https://raw.githubusercontent.com/YUZU-Hub/project-boilerplate/main/.github/workflows/deploy.yml
  ```

- [ ] **Delete old workflows** if migrating from PHP/shared hosting setup
  ```bash
  rm -f .github/workflows/deploy-web.yml
  rm -f .github/workflows/deploy-api.yml
  ```

---

## Quick Reference: What Goes Where

| File/Dir | Purpose |
|----------|---------|
| `homepage/` | Static landing/marketing pages |
| `webapp/` | Authenticated web application |
| `admin/` | System monitoring dashboard |
| `server/` | Node.js Express servers |
| `api/pb_hooks/` | PocketBase custom hooks |
| `api/pb_migrations/` | Database migrations |
| `Dockerfile` | Production container build |
| `docker-compose.yml` | Local development |

| Credential | Location | Scope |
|------------|----------|-------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `~/.zshrc` | All projects |
| `COOLIFY_URL`, `COOLIFY_TOKEN` | `~/.zshrc` | All projects |
| `POCKETBASE_ADMIN_*` | `~/.zshrc` | All projects |
| `API_URL` | `.env` | This project |
| `*_PORT` | `.env` | This project |

---

## Rollback

If something breaks:

1. **Docker issues**: `docker compose down -v` to reset
2. **MCP issues**: Delete `.mcp.json`, MCPs will just be unavailable
3. **Command issues**: Delete `.claude/commands/`, commands will be unavailable
4. **Workflow issues**: Revert via git, workflows only run on push to main

---

## After Migration

- [ ] Delete this `MIGRATION.md` file
- [ ] Update `CLAUDE.md` with project-specific details
- [ ] Test locally: `docker compose up --build`
- [ ] Commit changes: `git add -A && git commit -m "Adopt project boilerplate structure"`
