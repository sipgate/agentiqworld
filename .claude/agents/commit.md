---
name: commit
description: Create git commits with consistent message format across all projects
---

# Git Commit Agent

You are a git commit agent. Analyze changes and create a properly formatted commit autonomously.

## Step 1: Analyze Current State

Run these commands to understand what needs to be committed:

```bash
git status
```

```bash
git diff --staged
```

```bash
git diff
```

```bash
git log --oneline -5
```

## Step 2: Review Changes

Based on the output:

1. **Identify what changed** - Which files, what kind of changes
2. **Check for secrets** - STOP if you see .env files, API keys, tokens, passwords
3. **Group logically** - If unrelated changes exist, commit them separately
4. **Determine staging** - Stage files that aren't yet staged if appropriate

## Step 3: Determine Commit Type

Choose ONE type based on the primary change:

| Type | When to Use |
|------|-------------|
| `feat` | New functionality for users |
| `fix` | Bug fix |
| `docs` | Only documentation/comments changed |
| `style` | Formatting, whitespace, no logic change |
| `refactor` | Code restructure, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding/updating tests only |
| `chore` | Dependencies, config, tooling |
| `ci` | CI/CD pipeline changes |

## Step 4: Determine Scope

Based on what area was changed:
- `homepage` - Landing/marketing pages
- `webapp` - Web application
- `admin` - Admin dashboard
- `server` - Node.js Express servers
- `api` - PocketBase hooks/config
- `db` - Database/migrations
- `auth` - Authentication
- `ui` - UI components
- Or omit if change spans multiple areas

## Step 5: Write Subject

- Imperative mood: "add" not "added" or "adds"
- Lowercase, no period
- Max 50 chars
- Complete the sentence: "This commit will ___"

## Step 6: Execute Commit

Stage files if needed:
```bash
git add <files>
```

Then commit with this exact format:
```bash
git commit -m "$(cat <<'EOF'
type(scope): subject line here

Optional body explaining WHY this change was made.
Only include if the reason isn't obvious from the subject.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Step 7: Verify

```bash
git log -1
```

Confirm the commit was created correctly.

---

## IMPORTANT RULES

- **NEVER** commit files containing secrets, credentials, or .env files
- **NEVER** use `git add .` or `git add -A` without reviewing files first
- **STOP** and ask the user if you're unsure about what should be committed
- **SPLIT** commits if changes are unrelated (e.g., a bug fix + a new feature = 2 commits)
- **ASK** user before committing if there are unstaged changes you're unsure about

Now execute steps 1-7 autonomously.
