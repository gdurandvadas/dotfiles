---
name: role-code-review
description: MUST load for pull request or code quality reviews; SHOULD load for pre-commit self-review. Provides systematic review methodology with severity categorization.
license: MIT
compatibility: opencode
metadata:
  role: reviewer
  focus: quality-assurance
---

**Provides:** Systematic code review methodology, severity categorization, quality checklists, and feedback patterns.

## Quick Reference

**Golden Rule**: Review code as you'd want yours reviewed - thoroughly but kindly

**Checklist**: Functionality, Code Quality, Security, Testing, Performance, Maintainability

**Report Format**: Summary, Assessment, Issues (🔴🟡🔵), Positive Observations, Recommendations

**Principles**: Constructive, Thorough, Timely

## Review Principles

**Constructive**: Focus on code not person, explain WHY, suggest improvements, acknowledge good practices

**Thorough**: Check functionality not just style, consider edge cases, think maintainability, look for security

**Timely**: Review promptly, don't block unnecessarily, prioritize critical issues

## Review Checklist

### Functionality
- [ ] Does what it's supposed to do
- [ ] Edge cases handled
- [ ] Error cases handled
- [ ] No obvious bugs

### Code Quality
- [ ] Clear, descriptive naming
- [ ] Functions small and focused
- [ ] No unnecessary complexity
- [ ] Follows coding standards
- [ ] DRY - no duplication

### Security (Basic Checks)
- [ ] No obvious security issues
- [ ] Input validation present
- [ ] No hardcoded secrets
- [ ] Auth/authorization checks present

For comprehensive security review, use role-security-auditor skill

### Testing
- [ ] Tests present
- [ ] Happy path covered
- [ ] Edge cases covered
- [ ] Error cases covered
- [ ] All tests pass

### Performance
- [ ] No obvious performance issues
- [ ] Efficient algorithms
- [ ] No unnecessary operations
- [ ] Resources properly managed

### Maintainability
- [ ] Easy to understand
- [ ] Complex logic documented
- [ ] Follows project conventions
- [ ] Easy to modify/extend

## Review Report Format

```markdown
## Code Review: {Feature/PR Name}

**Summary:** {Brief overview}
**Assessment:** Approve / Needs Work / Requires Changes

---

### Issues Found

#### 🔴 Critical (Must Fix)
- **File:** `src/auth.js:42`
  **Issue:** Password stored in plain text
  **Fix:** Hash password before storing

#### 🟡 Warnings (Should Fix)
- **File:** `src/user.js:15`
  **Issue:** No input validation
  **Fix:** Validate email format

#### 🔵 Suggestions (Nice to Have)
- **File:** `src/utils.js:28`
  **Issue:** Could be more concise
  **Fix:** Use array methods instead of loop

---

### Positive Observations
- ✅ Good test coverage (95%)
- ✅ Clear function names
- ✅ Proper error handling

---

### Recommendations
{Next steps, improvements, follow-up items}
```

## Common Issues

### Security (Surface-Level)
🔴 Hardcoded credentials (obvious)
🔴 Missing input validation
🔴 Missing authentication/authorization

For comprehensive security review, use role-security-auditor skill

### Code Quality
🟡 Large functions (>50 lines)
🟡 Deep nesting (>3 levels)
🟡 Code duplication
🟡 Unclear naming
🟡 Missing documentation
🟡 Inconsistent style

### Testing
🟡 Missing tests
🟡 Low coverage (<80%)
🟡 Flaky tests
🟡 Tests testing implementation
🟡 No edge case coverage

### Performance
🔵 Inefficient algorithms
🔵 Unnecessary database queries
🔵 Missing caching
🔵 Large object allocations
🔵 No lazy loading

## Review Process

### Before Reviewing
- [ ] Understand the purpose of the changes
- [ ] Read the PR description or requirements
- [ ] Identify the files changed
- [ ] Load relevant code standards
- [ ] Check for related dependencies

### During Review
- [ ] Read through all changes
- [ ] Check against code standards
- [ ] Look for security issues first
- [ ] Verify edge cases are handled
- [ ] Check test coverage
- [ ] Consider performance implications
- [ ] Think about maintainability
- [ ] Note positive patterns

### After Review
- [ ] Categorize issues by severity
- [ ] Provide specific, actionable feedback
- [ ] Explain WHY changes are needed
- [ ] Suggest specific fixes
- [ ] Acknowledge good work
- [ ] Estimate effort for fixes
- [ ] Provide overall assessment

## Best Practices

✅ Review within 24 hours
✅ Provide specific, actionable feedback
✅ Explain WHY, not just WHAT
✅ Suggest alternatives
✅ Acknowledge good work
✅ Use severity levels (Critical/Warning/Suggestion)
✅ Test the code if possible
✅ Check for security issues first
✅ Consider edge cases
✅ Think about future maintenance
✅ Be thorough but kind
✅ Prioritize critical issues
✅ Offer help with fixes

## Security Review Checklist

For comprehensive security reviews, use the role-security-auditor skill.

For basic security checks during code review:

### Input Validation
- [ ] All user inputs validated
- [ ] Type checking present
- [ ] Sanitization for output

### Authentication & Authorization
- [ ] Proper authentication required
- [ ] Resource ownership verified
- [ ] Session management secure

### Data Protection
- [ ] No sensitive data in logs
- [ ] Proper secret management

## Example Review

```markdown
## Code Review: User Authentication

**Summary:** Adds login, registration, and password reset functionality to the auth module.
**Assessment:** Needs Work

---

### Issues Found

#### 🔴 Critical (Must Fix)
- **File:** `src/controllers/auth.js:45`
  **Issue:** Password stored in plain text
  **Fix:** Hash password using bcrypt before saving to database

- **File:** `src/routes/auth.js:23`
  **Issue:** SQL injection vulnerability in login query
  **Fix:** Use parameterized queries with prepared statements

#### 🟡 Warnings (Should Fix)
- **File:** `src/utils/validation.js:12`
  **Issue:** Email regex too permissive, allows invalid emails
  **Fix:** Use a more restrictive email validation pattern

- **File:** `src/services/email.js:8`
  **Issue:** No rate limiting on password reset requests
  **Fix:** Add rate limiting (e.g., 3 requests per hour per email)

#### 🔵 Suggestions (Nice to Have)
- **File:** `src/controllers/auth.js:30`
  **Issue:** Function is 75 lines, could be split
  **Fix:** Extract email sending logic to separate function

- **File:** `src/models/user.js:15`
  **Issue:** Consider adding emailVerified field
  **Fix:** Add boolean field for email verification status

---

### Positive Observations
- ✅ Good separation of concerns (routes, controllers, services)
- ✅ Comprehensive error handling
- ✅ Good use of async/await
- ✅ Proper HTTP status codes
- ✅ Clear, descriptive function names
- ✅ Test coverage at 85%

---

### Recommendations
1. Fix critical security issues before merging
2. Add rate limiting to prevent abuse
3. Improve email validation
4. Consider adding email verification flow
5. Extract large functions for better readability
6. Add integration tests for complete auth flow

**Overall:** Good foundation but security issues must be addressed before deployment.
```

## Review Assessment Levels

### Approve
- No critical issues
- Minor warnings are optional improvements
- Code is production-ready
- Tests are comprehensive and passing

### Needs Work
- No critical issues
- Some warnings that should be addressed
- Code is close to production-ready
- Minor fixes needed before merge

### Requires Changes
- Critical issues present
- Major concerns with functionality or security
- Code not ready for production
- Significant work needed

## Feedback Style Guidelines

### Constructive Feedback
- Focus on the code, not the person
- Provide specific examples
- Explain the impact of the issue
- Suggest concrete improvements
- Offer to help with implementation

### Tone Examples

❌ **Too harsh:** "This is terrible code. You don't understand security at all."

✅ **Constructive:** "I notice the password is stored in plain text. This creates a security vulnerability where user passwords could be exposed if the database is compromised. I recommend using bcrypt to hash passwords before storing them."

❌ **Too vague:** "This function is too long."

✅ **Constructive:** "The `authenticateUser` function is 75 lines long, which makes it harder to test and maintain. Consider extracting the email sending logic into a separate function, which would improve readability and make it easier to test each piece independently."

## When to Escalate

Escalate to team or security team when:
- Critical security vulnerabilities found
- Architectural concerns beyond scope of review
- Potential legal or compliance issues
- Major disagreements on approach
- Need for security audit

**Golden Rule**: Review code as you'd want yours reviewed - thoroughly but kindly.
