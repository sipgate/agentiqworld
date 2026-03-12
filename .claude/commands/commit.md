# Commit

Invoke the commit agent to create a git commit with consistent message format.

Run the `commit` agent to analyze staged changes and create a properly formatted commit.

## Commit Format

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**Scopes:** `homepage`, `webapp`, `admin`, `server`, `api`, `db`, `auth`, `ui` (or omit)
