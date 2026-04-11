---
name: tool-store
description: Load for storing/retrieving architectural decisions or cross-session context. Store items are NOT auto-loaded; must call storeread() explicitly.
license: MIT
compatibility: opencode
metadata:
  role: storage
  focus: persistent-memory
---

**Provides:** Persistent memory storage with tag-based discovery and durable context across sessions.

**CRITICAL:** Store items are NOT auto-loaded. You MUST call `storeread({ id: "<id>" })` when you see `Load store:` directives.

## Tools

### `storewrite` - Persist Memory

**Parameters:**
- `summary` (required): Brief 1-2 sentence description
- `tags` (required): Array of tags for categorization
- `status` (required): `"active"`, `"archived"`, or `"deprecated"`
- `data` (optional): JSON object with structured data
- `id` (optional): Update existing entry
- `links` (optional): Array of related item IDs

**Returns:** `{ success: boolean, id: string }`

### `storeread` - Retrieve Memory

**LIST mode** (no ID): Returns summaries without `data` field. Optional `tags` filter.

**READ mode** (with ID): Returns full item including `data` field.

### `storedelete` - Remove Memory

**Parameters:** `id` (required)

Deletion is permanent. Prefer `status: "archived"` for items with historical value.

---

## When to Store

Store items that are **permanent, cross-session, and non-obvious from the code**:
- Architectural decisions with rationale
- API specs and schemas
- Project constraints and requirements

Do NOT store ephemeral task progress, implementation plans, or information derivable from git history.

## Example

```javascript
storewrite({
  summary: "Selected PostgreSQL for primary database",
  tags: ["architecture", "database", "decision"],
  status: "active",
  data: {
    decision: "PostgreSQL",
    rationale: ["ACID compliance needed", "Team expertise", "JSON support"],
    alternatives_rejected: { MongoDB: "No transaction support" }
  }
})
```

## Tagging Strategy

- **Category:** `architecture`, `database`, `api`, `security`
- **Domain:** `auth`, `payments`, `user-mgmt`
- **Status:** `draft`, `approved`, `deprecated`

## Best Practices

- Always include rationale, not just facts
- Use `links` to cross-reference related items
- Update entries over time with implementation notes
- Prefer archival (`status: "archived"`) over deletion
- Discover existing items with `storeread()` (list mode) before creating duplicates
