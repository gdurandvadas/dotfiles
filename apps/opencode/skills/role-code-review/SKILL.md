---
name: role-code-review
description: Load for pull request or code quality reviews. Provides systematic review methodology with severity categorization.
license: MIT
compatibility: opencode
metadata:
  role: reviewer
  focus: quality-assurance
---

**Provides:** Code review methodology, severity categorization, and quality checklists.

## Review Checklist

### Functionality
- [ ] Does what it's supposed to do
- [ ] Edge cases handled
- [ ] Error cases handled

### Code Quality
- [ ] Clear, descriptive naming
- [ ] Functions small and focused
- [ ] No unnecessary complexity or duplication
- [ ] Follows project coding standards

### Security (Surface-Level)
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Auth/authorization checks present

For deep security review, use `role-security-auditor`.

### Testing
- [ ] Tests present with happy path, edge cases, and error cases
- [ ] All tests pass

### Performance
- [ ] No obvious performance issues
- [ ] Resources properly managed

### Maintainability
- [ ] Easy to understand
- [ ] Complex logic documented
- [ ] Follows project conventions

## Severity Levels

- **Critical (must fix):** Security vulnerabilities, data loss risk, broken functionality
- **Warning (should fix):** Missing validation, code duplication, low coverage, unclear naming
- **Suggestion (nice to have):** Style improvements, minor optimizations, refactoring opportunities

## Report Format

```markdown
## Code Review: {Feature/PR Name}

**Summary:** Brief overview
**Assessment:** Approve / Needs Work / Requires Changes

### Critical Issues
- **`file:line`** - Issue. **Fix:** Specific remediation.

### Warnings
- **`file:line`** - Issue. **Fix:** Suggestion.

### Suggestions
- **`file:line`** - Improvement opportunity.

### Positive Observations
- What's done well

### Recommendations
Next steps or follow-up items.
```

## Review Process

1. Understand the purpose (read PR description/requirements)
2. Check security issues first
3. Verify edge cases and error handling
4. Check test coverage
5. Consider performance and maintainability
6. Categorize issues by severity with specific, actionable feedback
7. Acknowledge good patterns

**Principles:** Focus on code not person. Explain WHY. Suggest alternatives. Be thorough but kind.
