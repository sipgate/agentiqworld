# Check PocketBase Status

Check the local PocketBase API health and list collections.

```bash
curl -s http://localhost:8090/api/health | jq .
```

If running, list collections:
```bash
curl -s http://localhost:8090/api/collections | jq '.items[].name'
```
