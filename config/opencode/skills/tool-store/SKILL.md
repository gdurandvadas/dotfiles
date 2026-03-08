---
name: tool-store
description: MUST load for storing/retrieving architectural decisions or TODO-store linking; auto-loaded by Universal agent. CRITICAL - Store items NOT auto-loaded; must call storeread() explicitly.
license: MIT
compatibility: opencode
metadata:
  role: storage
  focus: persistent-memory
---

**Provides:** Persistent memory storage with tag-based discovery, durable context across sessions, and TODO-Store linking patterns.

**CRITICAL:** Store items are NOT auto-loaded. You MUST explicitly call `storeread({ id: "<id>" })` when you see `Load store:` or `[store:<id>]` in prompts or TODO items.

## Tools

### `storewrite` - Persist Memory

**Parameters:**
- `summary` (required): Brief 1-2 sentence description
- `tags` (required): Array of tags for categorization
- `status` (required): `"active"`, `"archived"`, or `"deprecated"`
- `data` (optional): JSON object with actual data
- `id` (optional): Update existing entry
- `links` (optional): Array of related item IDs

**Returns:** `{ success: boolean, id: string }`

### `storeread` - Retrieve Memory

**Two modes:**

**LIST Mode** (no ID provided):
- Returns summaries WITHOUT `data` field (lightweight discovery)
- Optional `tags` filter

**READ Mode** (with ID):
- Returns full item INCLUDING `data` field

### `storedelete` - Remove Memory

**Parameters:**
- `id` (required): UUID of the item to permanently delete

**Returns:** `{ success: boolean, id: string, deleted: boolean }`

**Use this to:**
- Clean up obsolete or incorrect entries
- Remove sensitive information that should not persist
- Delete temporary experimental specs

**Important:**
- Deletion is **permanent** and cannot be undone
- **Prefer archival over deletion**: Use `status: "deprecated"` or `status: "archived"` for items that may have historical value
- Only delete when certain the information will never be needed
- For TODO-context items, consider leaving them after completion for audit trail

**Example:**

```javascript
// Remove obsolete item
storedelete({ id: "old-spec-123" })
// Returns: { success: true, id: "old-spec-123", deleted: true }
```

---

## Storage Decision Matrix

| Store Here | Store in `.opencode/sessions/` Context Files |
|------------|--------------------------------|
| Permanent decisions | Temporary work-in-progress |
| Project-wide context | Task-specific notes |
| Schemas & specs | Current implementation plan |
| Survives session end | Deleted after task |
| Shared across sessions | Session-specific |

---

## Use Cases

### 1. Store Critical Decisions

```javascript
storewrite({
  summary: "Selected PostgreSQL for primary database",
  tags: ["architecture", "database", "decision"],
  status: "active",
  data: {
    decision: "PostgreSQL",
    rationale: ["ACID compliance needed", "Team expertise", "JSON support"],
    alternatives_rejected: {
      MongoDB: "No transaction support",
      MySQL: "Weaker JSON handling"
    },
    date: "2026-01-13"
  }
})
```

### 2. Store Schemas

```javascript
storewrite({
  summary: "User authentication database schema",
  tags: ["database", "schema", "auth"],
  status: "active",
  data: {
    tables: {
      users: {
        columns: ["id UUID PRIMARY KEY", "email VARCHAR UNIQUE", "password_hash VARCHAR"],
        indexes: ["email"]
      },
      sessions: {
        columns: ["id UUID", "user_id UUID", "token VARCHAR", "expires_at TIMESTAMP"],
        foreign_keys: ["user_id -> users.id"]
      }
    }
  }
})
```

### 3. Store API Specs

```javascript
storewrite({
  summary: "REST API v1 endpoint specifications",
  tags: ["api", "rest", "spec"],
  status: "active",
  data: {
    base_url: "https://api.example.com/v1",
    authentication: "Bearer token",
    endpoints: [
      { path: "/users", method: "GET", auth: true, returns: "User[]" },
      { path: "/auth/login", method: "POST", auth: false, returns: "Token" }
    ]
  }
})
```

---

## Store Entry Audiences

Store entries serve two distinct audiences. Understanding the difference prevents context bloat and incorrect field usage.

### Plan entries (orchestrator / control plane)

Used by the orchestrator or universal agent to drive TODO creation and delegation.

- **Tags:** `["plan", "todo-context", ...]`
- **Include:** `data.prompt_drafts` (see section below)
- **Loaded by:** orchestrator/universal to kick off or resume execution

### Spec/context entries (implementer / data plane)

Used by subagents during implementation to understand requirements, constraints, and acceptance criteria.

- **Tags:** `["spec"]`, `["decision"]`, `["schema"]`, etc. — no `"plan"` tag
- **Do NOT include** `data.prompt_drafts` — that field is for plan entries only
- **Loaded by:** fast/balanced/deep agents via `Load store:` in their delegation prompt

### Cross-referencing plans and specs

Plans should link to their related spec/context entries using `links[]`. Per-task `task_block` prompts should explicitly load both the plan ID and any linked spec IDs so implementers have full context.

```javascript
storewrite({
  summary: "Plan: Implement payment gateway",
  tags: ["plan", "todo-context", "payments"],
  status: "active",
  links: ["payment-spec-abc", "api-schema-xyz"],  // ← Link to spec entries
  data: {
    // ...plan fields...
    prompt_drafts: {
      // Each task_block loads plan + linked specs:
      // Load store: <plan-id>, payment-spec-abc, api-schema-xyz
    }
  }
})
```

---

## Plan Prompt Drafts (Compaction-Safe Execution)

**Problem:** When a plan is stored and later loaded after compaction, the agent has the plan structure but lacks the context needed to draft good delegation prompts — skills, requirements, and success criteria were all in the original conversation.

**Solution:** Embed copy-pastable `Task({ ... })` blocks directly in the stored plan. After compaction, load the plan and use the drafts verbatim.

### When Required

Prompt drafts **MUST** be included in a stored plan when **any** of:
- [ ] Plan will produce **3+ TODO items**
- [ ] Estimated effort **> 60 minutes**
- [ ] Plan involves **multiple phases or agents**

Otherwise optional but recommended.

### Canonical `data.prompt_drafts` Shape

```json
{
  "prompt_drafts": {
    "universal_handoff_prompt": "@orchestrator Load store: <plan-store-id>\n\nTask: Execute the stored plan.",
    "todo_tasks": [
      {
        "todo_title": "Short display title for this step",
        "todo_content": "Short display title for this step [store:<plan-store-id>]",
        "task_block": "Task({ ... })"
      }
    ]
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `prompt_drafts.universal_handoff_prompt` | Yes | Plain copy-paste message (e.g. `@orchestrator Load store: <id>\n\nTask: ...`) for the user to resume execution — **not** a `Task({ ... })` wrapper, since `orchestrator`/`universal` are primary agents, not subagent targets |
| `prompt_drafts.todo_tasks[].todo_title` | Yes | Short label for the TODO item |
| `prompt_drafts.todo_tasks[].todo_content` | Yes | TODO text including `[store:<plan-id>]` reference |
| `prompt_drafts.todo_tasks[].task_block` | Yes | Full `Task({ ... })` for delegating this specific step to a subagent (fast/balanced/deep/etc.) |

**Keep prompt drafts concise:** reference file paths and store IDs rather than pasting code. Each `task_block` should be executable after a `storeread`.

**After storing:** replace every `<plan-store-id>` placeholder with the actual returned ID before presenting the handoff to the user.

### Full Example

```javascript
const result = storewrite({
  summary: "Plan: Add OAuth2 login flow with GitHub provider",
  tags: ["plan", "feature", "auth", "todo-context"],
  status: "active",
  data: {
    goal: "Implement GitHub OAuth2 login so users can sign in without a password",
    approach: [
      "Add OAuth2 provider config and env vars",
      "Implement callback handler and session creation",
      "Write integration tests"
    ],
    affected_files: ["config/auth.ts", "routes/auth.ts"],
    risks: ["OAuth state param CSRF", "Session fixation on login"],
    verification: "E2E: user can complete GitHub login; unit tests for callback handler",
    estimated_effort: "2-3 hours",
    prompt_drafts: {
      universal_handoff_prompt: `@orchestrator Load store: <plan-store-id>

Task: Execute the stored OAuth2 GitHub login plan.
Load the plan, convert each step to a TODO using prompt_drafts.todo_tasks
entries (todo_content field), then delegate each using the corresponding task_block.`,
      todo_tasks: [
        {
          todo_title: "Add OAuth2 config and env vars",
          todo_content: "Add OAuth2 config and env vars [store:<plan-store-id>]",
          task_block: `Task({
  subagent_type: "fast",
  description: "Add OAuth2 config and env vars",
  prompt: \`
Load skills: role-developer, standards-security
Load store: <plan-store-id>

Task: Add OAuth2 GitHub provider config and required environment variables.

Requirements:
- Add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET to env schema in config/auth.ts
- Do not commit secrets

Success Criteria:
- config/auth.ts exists and exports provider config
- Env schema validates required vars
  \`
})`
        },
        {
          todo_title: "Implement callback handler",
          todo_content: "Implement callback handler [store:<plan-store-id>]",
          task_block: `Task({
  subagent_type: "balanced",
  description: "Implement OAuth2 callback and session creation",
  prompt: \`
Load skills: role-developer, standards-security
Load store: <plan-store-id>

Task: Implement the OAuth2 callback route and session creation in routes/auth.ts.

Requirements:
- Validate state param to prevent CSRF
- Create session after successful OAuth exchange

Success Criteria:
- Callback handles valid and invalid state params
- Session created and user redirected on success
  \`
})`
        },
        {
          todo_title: "Write integration tests",
          todo_content: "Write integration tests [store:<plan-store-id>]",
          task_block: `Task({
  subagent_type: "balanced",
  description: "Write OAuth2 integration tests",
  prompt: \`
Load skills: role-qa-engineer, standards-testing
Load store: <plan-store-id>

Task: Write integration tests for the GitHub OAuth2 callback handler.

Requirements:
- Happy path: valid code + state → session created
- CSRF: invalid state → rejected

Success Criteria:
- All tests pass; callback error paths covered
  \`
})`
        }
      ]
    }
  }
})
// Returns: { success: true, id: "<plan-store-id>" }
// After storing: replace <plan-store-id> in all prompt_drafts with the returned id
```

---

## TODO-Store Linking Pattern

**Problem:** TODO items have limited space. Complex tasks need detailed specs.

**Solution:** Store details in memory, reference from TODO using `[store:id]` syntax.

### Workflow

**Step 1: Store detailed context**

```javascript
const result = storewrite({
  summary: "Payment gateway integration specification",
  tags: ["feature", "payments", "spec", "todo-context"],
  status: "active",
  data: {
    requirements: ["PCI-DSS compliant", "Support credit cards", "Handle webhooks"],
    endpoints: ["/api/payments/create", "/api/payments/webhook"],
    security: ["Never store card numbers", "Use Stripe tokens"],
    acceptance: ["User can checkout", "Failed payments show error"],
    estimated_effort: "3-5 days"
  }
})
// Returns: { success: true, id: "store-abc-123" }
```

**Step 2: Create TODO with reference**

```javascript
todowrite({
  todos: [{
    id: "todo-1",
    content: "Implement Stripe payment gateway [store:store-abc-123]",
    status: "pending",
    priority: "high"
  }]
})
```

**Step 3: Retrieve when working on TODO**

```javascript
// Parse store ID from TODO: [store:store-abc-123]
const context = storeread({ id: "store-abc-123" })
// Now have full requirements, specs, and acceptance criteria
```

**Step 4: Update store as work progresses**

```javascript
storewrite({
  id: "store-abc-123",
  data: {
    ...existingData,
    implementation_notes: [{
      date: "2026-01-13",
      note: "Used Stripe Checkout for PCI compliance"
    }],
    actual_effort: "4 days"
  }
})
```

### Benefits

- ✅ TODO stays concise
- ✅ Full context available on-demand
- ✅ Context survives after TODO completion
- ✅ Same spec can inform multiple TODOs
- ✅ Audit trail of decisions

---

## Best Practices

### Tagging Strategy

```javascript
// Category (what type)
["architecture", "database", "api", "security"]

// Domain (which feature)
["auth", "payments", "user-mgmt"]

// Status metadata
["draft", "approved", "deprecated"]

// Priority
["critical", "important"]

// Special: TODO context marker
["todo-context"]  // ← Indicates referenced by TODOs
```

### Link Related Items

```javascript
storewrite({
  summary: "Payment API migration plan",
  tags: ["api", "migration", "payments"],
  status: "active",
  links: ["payment-schema-123", "api-spec-456"],  // ← Cross-reference
  data: { /* ... */ }
})
```

### Store Rationale

```javascript
// ✅ GOOD: Includes "why"
data: {
  cache: "Redis",
  rationale: "Sub-ms latency needed for real-time",
  alternatives: { memcached: "No persistence" }
}

// ❌ BAD: Just facts
data: { cache: "Redis" }
```

### Update Over Time

```javascript
// Mark deprecated
storewrite({
  id: "old-spec",
  status: "deprecated",
  data: {
    ...existing,
    deprecated_reason: "Replaced by v2.0",
    replaced_by: "new-spec-id"
  }
})
```

### Archival vs Deletion

**Prefer archival for:**
- Architectural decisions (historical context)
- Deprecated specs (may need reference)
- Completed TODO-context items (audit trail)
- Migration plans (lessons learned)

**Use deletion for:**
- Truly incorrect information
- Sensitive data that must be removed
- Duplicate entries
- Test/experimental items

```javascript
// ✅ GOOD: Archive deprecated items
storewrite({ 
  id: "payment-v1-spec", 
  status: "deprecated",
  data: { 
    ...existing, 
    deprecated_reason: "Migrated to Stripe v2 API",
    replaced_by: "payment-v2-spec-789" 
  }
})

// ⚠️ USE SPARINGLY: Permanent deletion
storedelete({ id: "accidental-duplicate" })
```

---

## Quick Reference

**When to store:**
- [ ] Is this permanent (not temporary)?
- [ ] Will other agents/sessions need this?
- [ ] Is this a decision, schema, or requirement?
- [ ] Have I included rationale (not just facts)?
- [ ] Will TODO items reference this?

**Tag consistently:**
- Use `todo-context` tag for TODO-referenced items
- Review existing tags first: `storeread()`

**Link comprehensively:**
- Related store items via `links` array
- TODO items via `[store:id]` syntax

**Update regularly:**
- Add implementation notes
- Track actual vs estimated effort
- Mark deprecated when replaced

---

## Summary

**Memory Store = Durable Project Knowledge**

- Survives sessions, restarts, compaction
- Tag-based discovery
- TODO integration via `[store:id]`
- Shared across all agents
- Includes rationale, not just facts
