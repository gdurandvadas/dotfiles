---
name: work-ai-attribution
description: AI attribution rules for work commits, PRs, and ClickUp comments.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: git
  priority: critical
---

# AI Attribution (Work)

**Provides:** Rules for attributing AI-generated work in commits, pull requests, and ticket comments.

## Commits

Every commit must include the `ai-generated` git trailer:

```bash
git commit -m "feat(auth): add oauth2 login flow [DEV-123]" \
           -m "" \
           -m "ai-generated: true"
```

Never omit this trailer, even for small changes.

## Pull Requests

### Required Labels

Apply both labels to every AI-generated PR:

- `ai-generated`
- `ai-agent-<agentName>` (e.g. `ai-agent-code`, `ai-agent-orchestrate`)

```bash
gh pr edit <PR_NUMBER> --add-label "ai-generated,ai-agent-code"
```

### Required PR Body Notice

Include this footer in every PR description:

```markdown
---
> Generated with AI assistance (`<agent-name>`). Reviewed by @<author>.
```

## ClickUp Comments

When posting plans, resume notes, or implementation results:

```
[AI-generated — agent: <agent-name>]
```

Place at the top of the comment body.

## Checklist

Before closing any work session:

- [ ] All commits have `ai-generated: true` trailer
- [ ] PR has `ai-generated` and `ai-agent-<name>` labels
- [ ] PR body includes AI notice footer
- [ ] ClickUp comments posted by AI are labelled
