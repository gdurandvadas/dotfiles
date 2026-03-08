---
name: role-developer
description: MUST load for feature implementation or production code; SHOULD load for bug fixes with testing. Follows pragmatic TDD with standards skill loading guidance.
license: MIT
compatibility: opencode
metadata:
  role: developer
  focus: implementation
---

**Provides:** Pragmatic TDD workflow, standards skill loading guidance, implementation checklists.

## Quick Reference

**Development Flow**: Implement → Test → Verify → Commit

**MUST load standards skills** before starting:
- `standards-code` - Always load for any code implementation
- `standards-testing` - Load when writing tests
- `standards-security` - Load for auth, data handling, or external APIs
- `standards-documentation` - Load for public APIs or complex logic

**Core Practices**: TDD, Small commits, Self-documenting code, Early testing

---

## Pragmatic Developer Workflow

### Phase 1: Understand & Prepare

#### Step 1: Load Required Standards Skills

**MANDATORY: Always load relevant standards before starting**

**For ALL code implementation:**
```
skill(name: "standards-code")
```

**When writing tests:**
```
skill(name: "standards-testing")
```

**For security-sensitive code (auth, data handling, APIs):**
```
skill(name: "standards-security")
```

**For public APIs or complex logic:**
```
skill(name: "standards-documentation")
```

**Load multiple skills when needed:**
```
skill(name: "standards-code")
skill(name: "standards-testing")
skill(name: "standards-security")
```

**When working with complex features or stored specifications:**
```
skill(name: "tool-store")
```

Provides TODO-Store linking pattern (`[store:id]` syntax), how to create/retrieve store items, and examples for storing specs and decisions.

#### Step 2: Understand Requirements

- [ ] Requirements clear and complete?
- [ ] Edge cases identified?
- [ ] Acceptance criteria defined?
- [ ] Dependencies and constraints understood?
- [ ] Store items loaded if referenced via `[store:id]`? (Load tool-store skill for guidance)

**If unclear → Ask for clarification before coding**

#### Step 3: Plan Approach

**Quick mental checklist:**
- What components need to change or be created?
- What's the simplest implementation that works?
- What tests will prove it works?
- What could go wrong? (edge cases, errors)

**Keep it simple** - YAGNI (You Aren't Gonna Need It)

---

## Phase 2: Implement

### Follow TDD Pattern (When Appropriate)

**Red → Green → Refactor:**

1. **Red**: Write failing test first (defines expected behavior)
2. **Green**: Write simplest code to make test pass
3. **Refactor**: Clean up while tests stay green

**Not always strict TDD, but always:**
- Think about testability while coding
- Write tests before declaring done
- Keep tests and code in sync

### Code Implementation Principles

Apply principles from `standards-code` skill (load it first!):

**Core patterns:**
- ✅ Pure functions (predictable, testable)
- ✅ Immutability (create new data, don't modify)
- ✅ Small functions (< 50 lines)
- ✅ Explicit dependencies (dependency injection)
- ✅ Single responsibility per function/module

**Avoid:**
- ❌ Mutation and side effects
- ❌ Deep nesting (use early returns)
- ❌ God modules (split into focused modules)
- ❌ Global state

**Error handling:**
- Validate at boundaries (input validation)
- Return explicit success/error results
- Handle errors gracefully
- Log errors with context

**Naming:**
- Functions: verbPhrases (`getUser`, `validateEmail`)
- Predicates: `isValid`, `hasPermission`, `canAccess`
- Variables: descriptive, `const` by default
- Files: `lowercase-with-dashes.js`

### Security Considerations

Apply principles from `standards-security` skill when handling:

**Authentication/Authorization:**
- Never trust user input
- Validate and sanitize all inputs
- Use parameterized queries (prevent SQL injection)
- Implement proper session management
- Follow least privilege principle

**Data Protection:**
- Never log sensitive data (passwords, tokens, PII)
- Encrypt sensitive data at rest and in transit
- Use environment variables for secrets
- Never commit secrets to version control

**Common Vulnerabilities (OWASP Top 10):**
- SQL Injection → Use parameterized queries
- XSS → Escape output, sanitize input
- CSRF → Use CSRF tokens
- Authentication issues → Proper session handling
- Sensitive data exposure → Encrypt, don't log

**If security-sensitive code → MUST load `standards-security` skill**

---

## Phase 3: Test

### Write Comprehensive Tests

Apply principles from `standards-testing` skill (load it first!):

**Test levels:**
- **Unit tests**: Test individual functions in isolation
- **Integration tests**: Test component interactions
- **E2E tests**: Test full user workflows (when appropriate)

**AAA Pattern:**
```javascript
// Arrange: Setup test data and state
const user = { name: "John", age: 30 };

// Act: Execute the function being tested
const result = validateUser(user);

// Assert: Verify the outcome
expect(result.isValid).toBe(true);
```

**What to test:**
- ✅ Happy path (normal case works)
- ✅ Edge cases (empty, null, boundary values)
- ✅ Error cases (invalid input, failures)
- ✅ Business logic correctness

**What NOT to test:**
- ❌ Framework internals
- ❌ Third-party library behavior
- ❌ Trivial getters/setters

**Test quality:**
- Tests should be independent (no shared state)
- Tests should be fast
- Tests should be deterministic (same result every time)
- One assertion per test (ideally)
- Clear test names describe what's being tested

### Coverage Goals

**Target: 80%+ coverage for business logic**

Coverage isn't everything, but:
- Critical paths should have tests
- Edge cases should be covered
- Error handling should be tested

**Run tests frequently:**
```bash
npm test          # Run all tests
npm test -- --watch  # Watch mode during development
```

---

## Phase 4: Verify

### Quality Checklist

**Before considering work done:**

- [ ] Code follows standards (loaded `standards-code`?)
- [ ] All tests written and passing
- [ ] Edge cases covered
- [ ] Error handling implemented
- [ ] Security best practices applied (if applicable)
- [ ] No obvious bugs or issues
- [ ] Self-documenting code (clear names, structure)
- [ ] Comments added for complex logic (WHY, not WHAT)
- [ ] No console.logs or debug code left behind
- [ ] Dependencies properly injected (testable)

**Load relevant standards skills to verify:**
```
skill(name: "standards-code")      # Verify code quality
skill(name: "standards-testing")   # Verify test coverage
skill(name: "standards-security")  # Verify security (if applicable)
```

### Code Review Self-Check

**Read your own code critically:**
- Is this easy to understand?
- Could this be simpler?
- Will future-me understand this?
- Are there hidden assumptions?
- What could break this?

**If you struggle to explain it → Refactor it**

### Run Final Checks

```bash
# Tests pass
npm test

# Linter passes
npm run lint

# Type checks (if applicable)
npm run type-check

# Build succeeds (if applicable)
npm run build
```

**All must pass before committing**

---

## Phase 5: Commit

### Atomic Commits

**One logical change per commit:**
- Easier to review
- Easier to revert if needed
- Clear history

**Good commit message:**
```
Add user authentication with JWT tokens

- Implement login/logout endpoints
- Add password hashing with bcrypt
- Create JWT token generation and validation
- Add authentication middleware
- Include unit and integration tests
```

**Format:**
- First line: Concise summary (50 chars)
- Blank line
- Detailed bullets explaining changes
- Focus on WHAT and WHY, not HOW

**Commit after each completed task, not at end of day**

---

## When to Load Which Standards

### Always Load

**`standards-code`**: Load for ANY code implementation
- Provides core coding principles
- Modular design patterns
- Error handling guidance
- Naming conventions

### Load When Needed

**`standards-testing`**: Load when writing tests
- Test levels and patterns
- AAA pattern
- Coverage goals
- What to test vs. what to skip

**`standards-security`**: Load for security-sensitive code
- Authentication/authorization
- Input validation
- Data protection
- OWASP Top 10 prevention

**`standards-documentation`**: Load when documenting
- Public APIs
- Complex algorithms
- Architecture decisions
- README files

### Example: Implementing Authentication Feature

```
# Load multiple relevant standards
skill(name: "standards-code")      # Core coding practices
skill(name: "standards-security")  # Auth patterns and security
skill(name: "standards-testing")   # Test guidance

# Now implement with all relevant guidance loaded
```

---

## Integration with Other Skills

**With `role-architect`**: Use architectural guidance for structure decisions
**With `role-qa-engineer`**: Leverage testing expertise for comprehensive test strategy
**With `role-security-auditor`**: Get security audit perspective for critical code
**With `role-code-review`**: Self-review code before submitting

---

## Common Patterns

### Pattern 1: New Feature Implementation

```
1. Load standards: standards-code, standards-testing
2. Understand requirements
3. Plan approach (keep it simple)
4. Implement incrementally:
   - Write test (red)
   - Implement code (green)
   - Refactor (clean)
5. Verify quality checklist
6. Commit atomically
```

### Pattern 2: Bug Fix

```
1. Load standards: standards-code, standards-testing
2. Reproduce bug with failing test first
3. Fix the bug (make test pass)
4. Verify fix doesn't break other tests
5. Consider edge cases (add more tests if needed)
6. Commit with clear description
```

### Pattern 3: Refactoring

```
1. Load standards: standards-code, standards-testing
2. Ensure tests exist for current behavior
3. Refactor incrementally (tests stay green)
4. Verify tests still pass after each change
5. Commit each refactoring step
6. Final verification and cleanup
```

---

## Best Practices Summary

### DO (✅)

- **Always load relevant standards skills first**
- Write tests before declaring done
- Keep functions small and focused (< 50 lines)
- Use descriptive names
- Handle errors explicitly
- Validate input at boundaries
- Make code self-documenting
- Commit frequently with clear messages
- Review your own code critically

### DON'T (❌)

- Skip loading standards skills
- Skip tests ("I'll add them later")
- Leave debug code or console.logs
- Ignore error cases
- Write God modules
- Use global state
- Commit broken tests
- Commit without running tests
- Over-engineer for future needs

---

## Quick Start Checklist

**Starting new implementation:**
- [ ] Loaded `standards-code` skill
- [ ] Loaded `standards-testing` skill
- [ ] Loaded `standards-security` skill (if needed)
- [ ] Requirements and acceptance criteria clear
- [ ] Store items loaded if referenced via `[store:id]`? (See tool-store skill)
- [ ] Approach planned (simple solution)
- [ ] Ready to implement with tests

**Before committing:**
- [ ] All tests pass
- [ ] Code follows standards
- [ ] Edge cases covered
- [ ] Error handling implemented
- [ ] Self-reviewed for quality
- [ ] No debug code left
- [ ] Clear commit message ready

---

## Remember

**Standards skills are your reference guides** - Load them explicitly before starting work.

**Quality comes from discipline** - Follow the workflow consistently.

**Simple is better than clever** - Write code others (and future-you) can understand.

**Tests are not optional** - They prove your code works and prevent regressions.

**Commit often** - Small, atomic commits are easier to review and revert.

**When in doubt, ask** - Better to clarify requirements than implement the wrong thing.
