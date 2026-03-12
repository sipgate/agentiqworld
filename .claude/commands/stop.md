# Stop Development Environment

Stop all local development services.

## Stop All Services

```bash
docker compose down
```

## Stop and Remove Volumes

To stop and remove all data (use with caution):

```bash
docker compose down -v
```

Note: This will delete all PocketBase data stored in the `pb_data` volume.
