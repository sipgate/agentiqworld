# PocketBase Migrations

Place migration files here. They run automatically when PocketBase starts.

## Naming Convention

Files must be named: `TIMESTAMP_description.js` (e.g., `1737500000_create_todos.js`)

## Example Migration

See `CLAUDE.md` for a complete example with `saveNoValidate()` for collections with field-dependent rules.

## Quick Reference

```javascript
/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // Create collection
    const collection = new Collection({
        name: "items",
        type: "base",
        fields: [
            { type: "text", name: "title", required: true },
            { type: "bool", name: "active" },
            // Always include autodate fields:
            { type: "autodate", name: "created", onCreate: true, onUpdate: false },
            { type: "autodate", name: "updated", onCreate: true, onUpdate: true }
        ]
    });
    app.save(collection);
}, (app) => {
    // Rollback
    app.delete(app.findCollectionByNameOrId("items"));
});
```

## Tips

- Use `app.saveNoValidate()` when rules reference the collection's own fields
- Use `app.findCollectionByNameOrId("users")` to get the users collection ID for relations
- Migrations run in alphabetical order by filename
