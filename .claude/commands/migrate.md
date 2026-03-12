# Migrate Existing Project

Help migrate an existing project to the boilerplate structure.

## Check Current State

First, let's see what's already in place:

```bash
ls -la CLAUDE.md .editorconfig LICENSE .mcp.json 2>/dev/null || echo "Missing foundation files"
ls -la .claude/ 2>/dev/null || echo "No .claude directory"
ls -la .github/workflows/ 2>/dev/null || echo "No workflows"
```

## Check Shared Credentials

```bash
[ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ] && echo "✓ GitHub token" || echo "✗ GitHub token missing"
[ -n "$POCKETBASE_ADMIN_EMAIL" ] && echo "✓ PocketBase email" || echo "✗ PocketBase email missing"
[ -n "$POCKETBASE_ADMIN_PASSWORD" ] && echo "✓ PocketBase password" || echo "✗ PocketBase password missing"
```

If any show ✗, set them up in `~/.zshrc` first (see `.env.shared.example` in boilerplate).

## Migration Phases

Tell me which phase you want to work on:

1. **Foundation** - CLAUDE.md, .editorconfig, LICENSE
2. **Claude Code** - .claude/ directory, .mcp.json
3. **Git Hygiene** - .gitignore updates
4. **Environment** - Configure .env files
5. **Docker Structure** - Dockerfile, docker-compose.yml, entrypoint.sh
6. **Server Structure** - server/*.js Express servers
7. **Frontend Structure** - homepage/, webapp/, admin/ directories
8. **PocketBase** - api/pb_hooks, api/pb_migrations
9. **CI/CD** - GitHub Actions workflows

See `MIGRATION.md` for detailed checklist.
