---
name: work-ai-attribution
description: Load for all work commits and PRs. Enforces AI attribution via git trailers, PR labels, and PR body notice.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: git
  priority: critical
---

# AI Attribution (Work)

**Provides:** Rules for attributing AI-generated work in commits, pull requests, and ticket comments — ensuring organizational transparency.

## Commits

Every commit must include the `ai-generated` git trailer:

```bash
git commit -m "feat(auth): add OAuth2 login flow [TASK-123]" \
           -m "" \
           -m "ai-generated: true"
```

Never omit this trailer, even for small or trivial changes.

## Pull Requests

### Required Labels

Apply both labels to every AI-generated PR:
- `ai-generated`
- `ai-agent-<agentName>` (e.g. `ai-agent-craft`, `ai-agent-forge`)

```bash
gh pr edit <PR_NUMBER> --add-label "ai-generated,ai-agent-craft"
```

### Required PR Body Notice

Include this footer in every PR description:

```markdown
---
> 🤖 Generated with AI assistance (`<agent-name>`). Reviewed by @<author>.
```

Example:
```markdown
---
> 🤖 Generated with AI assistance (`agent.craft`). Reviewed by @gedv.
```

## Ticket Comments

When posting implementation results or plans to a ClickUp ticket, include:

```
[AI-generated — agent: <agent-name>]
```

at the top of the comment.

## Checklist

Before closing any work session:
- [ ] All commits have `ai-generated: true` trailer
- [ ] PR has `ai-generated` + `ai-agent-<name>` labels
- [ ] PR body includes AI notice footer
- [ ] Ticket comments posted by AI are labelled
