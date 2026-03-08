---
name: role-qa-engineer
description: MUST load for test strategy design or edge case identification; SHOULD load for comprehensive test suites or coverage evaluation. Plans test organization systematically.
license: MIT
compatibility: opencode
metadata:
  role: quality-assurance
  focus: testing
---

**Provides:** Test strategy planning, edge case identification, coverage evaluation, and test organization methodology.

## Quick Reference

**Test Levels**: Unit → Integration → E2E

**AAA Pattern**: Arrange → Act → Assert

**Coverage Goals**: Critical paths 100%, High-risk 90%+, General 80%+

**Test Pyramid**: Many unit tests, some integration tests, few E2E tests

**Reference**: `skill:standards-testing`

---

## Testing Levels

### Unit Tests
**What:** Test individual functions/methods in isolation
**Goal:** Verify logic correctness
**Speed:** Fast (milliseconds)
**Coverage:** High (most tests should be unit tests)

**When to write:**
- For business logic
- For utility functions
- For data transformations
- For validation logic

**When NOT to write:**
- For trivial getters/setters
- For framework code
- For simple passthroughs

**Example scope:**
```javascript
// Test this function in isolation
function calculateDiscount(price, discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid discount');
  }
  return price * (1 - discountPercent / 100);
}

// Test cases:
// - Valid discount (10%)
// - Edge: 0% discount
// - Edge: 100% discount
// - Error: negative discount
// - Error: >100% discount
```

### Integration Tests
**What:** Test interaction between components
**Goal:** Verify components work together
**Speed:** Medium (seconds)
**Coverage:** Medium (focus on critical paths)

**When to write:**
- For API endpoints
- For database operations
- For external service integration
- For multi-component flows

**Example scope:**
```javascript
// Test API endpoint with real database
test('POST /users creates user in database', async () => {
  const response = await request(app)
    .post('/users')
    .send({ name: 'Alice', email: 'alice@example.com' });
  
  expect(response.status).toBe(201);
  
  // Verify in database
  const user = await db.users.findByEmail('alice@example.com');
  expect(user.name).toBe('Alice');
});
```

### End-to-End (E2E) Tests
**What:** Test complete user flows through the system
**Goal:** Verify system works as a whole
**Speed:** Slow (minutes)
**Coverage:** Low (only critical user journeys)

**When to write:**
- For critical user flows (login, checkout, etc.)
- For happy path scenarios
- For regression protection

**Example scope:**
```javascript
// Test complete user registration flow
test('User can register and login', async () => {
  // 1. Visit registration page
  await page.goto('/register');
  
  // 2. Fill form
  await page.fill('[name=email]', 'user@example.com');
  await page.fill('[name=password]', 'SecurePass123');
  await page.click('button[type=submit]');
  
  // 3. Verify redirected to dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // 4. Logout
  await page.click('button#logout');
  
  // 5. Login again
  await page.goto('/login');
  await page.fill('[name=email]', 'user@example.com');
  await page.fill('[name=password]', 'SecurePass123');
  await page.click('button[type=submit]');
  
  // 6. Verify back on dashboard
  await expect(page).toHaveURL('/dashboard');
});
```

---

## Test Patterns

### AAA Pattern (Arrange-Act-Assert)

**The Standard Pattern for Clear Tests:**

```javascript
test('calculateDiscount applies percentage correctly', () => {
  // ARRANGE: Set up test data and preconditions
  const price = 100;
  const discount = 10;
  
  // ACT: Execute the code under test
  const result = calculateDiscount(price, discount);
  
  // ASSERT: Verify the result
  expect(result).toBe(90);
});
```

**Benefits:**
- Clear test structure
- Easy to understand
- Consistent across codebase

### Given-When-Then (BDD Style)

**Alternative Pattern for Behavior-Driven Development:**

```javascript
test('User login', () => {
  // GIVEN: User exists in system
  const user = createUser({ email: 'test@example.com', password: 'pass123' });
  
  // WHEN: User attempts to login
  const result = login('test@example.com', 'pass123');
  
  // THEN: Login succeeds and returns token
  expect(result.success).toBe(true);
  expect(result.token).toBeDefined();
});
```

---

## Edge Cases and Failure Points

### Common Edge Cases to Test

**Boundary Values:**
- Minimum value (0, -1, empty)
- Maximum value (limits, capacity)
- Just inside boundary
- Just outside boundary

**Empty/Null/Undefined:**
- Empty string, array, object
- Null values
- Undefined values
- Missing optional parameters

**Special Characters:**
- Unicode, emoji
- SQL special characters (', --, ;)
- HTML special characters (<, >, &)
- Whitespace (spaces, tabs, newlines)

**Large Inputs:**
- Very long strings
- Large arrays
- Deep nesting
- Large file uploads

**Timing:**
- Concurrent operations
- Race conditions
- Timeouts
- Order of operations

### Identifying Failure Points

**Ask these questions:**
1. What happens if this fails?
2. What if the input is invalid?
3. What if the user does something unexpected?
4. What if external service is down?
5. What if two users do this simultaneously?
6. What if the network is slow?
7. What if we run out of resources?

**Common failure points:**
- External API calls (network, timeout, rate limits)
- Database operations (connection, deadlock, constraint violation)
- File system operations (permissions, disk space, concurrent access)
- User input (malformed, malicious, unexpected)
- Third-party libraries (bugs, version incompatibility)

---

## Test Coverage

### Coverage Types

**Line Coverage:** % of code lines executed
**Branch Coverage:** % of decision branches taken
**Function Coverage:** % of functions called
**Statement Coverage:** % of statements executed

### Coverage Goals

**Critical Paths (100%):**
- Authentication and authorization
- Payment processing
- Data integrity operations
- Security-critical code

**High-Risk Areas (90%+):**
- Business logic
- Data transformations
- Complex algorithms
- Error handling

**General Code (80%+):**
- Utility functions
- API endpoints
- Service layer
- Controllers

**Don't aim for 100% everywhere:**
- Diminishing returns
- Focus on high-value tests
- Some code is hard to test (not worth the effort)

---

## Test Organization

### File Structure

**Co-locate tests with code:**
```
src/
  services/
    userService.js
    userService.test.js
  utils/
    validation.js
    validation.test.js
```

**Or separate test directory:**
```
src/
  services/
    userService.js
  utils/
    validation.js
tests/
  services/
    userService.test.js
  utils/
    validation.test.js
```

### Naming Conventions

**Test files:** `{name}.test.js` or `{name}.spec.js`
**Test descriptions:** Be specific and clear

```javascript
// ❌ Vague
test('user test', () => { ... });

// ✅ Clear
test('createUser throws error when email is invalid', () => { ... });
```

### Grouping Tests

```javascript
describe('UserService', () => {
  describe('createUser', () => {
    test('creates user with valid data', () => { ... });
    test('throws error when email is invalid', () => { ... });
    test('throws error when email already exists', () => { ... });
  });
  
  describe('updateUser', () => {
    test('updates user name', () => { ... });
    test('throws error when user not found', () => { ... });
  });
});
```

---

## Testing Strategies

### Test Pyramid

```
      /\
     /E2E\      ← Few (slow, expensive, brittle)
    /------\
   /  Integ \   ← Some (medium speed, medium cost)
  /----------\
 /    Unit    \ ← Many (fast, cheap, reliable)
/--------------\
```

**Why:**
- Unit tests are fast and reliable (run constantly)
- Integration tests catch component interaction issues
- E2E tests catch system-level issues
- More unit tests = faster feedback

### Test-Driven Development (TDD)

**Red-Green-Refactor Cycle:**
1. **Red:** Write failing test
2. **Green:** Write minimal code to pass
3. **Refactor:** Improve code while keeping tests green

**Benefits:**
- Forces testable design
- Documents expected behavior
- Catches regressions early
- Encourages small, focused changes

**When to use:**
- Complex business logic
- Bug fixes (write failing test first)
- New features with clear requirements

### Behavior-Driven Development (BDD)

**Focus on behavior, not implementation:**
```javascript
describe('User Registration', () => {
  it('should send welcome email after successful registration', () => {
    // Focus on observable behavior
  });
  
  it('should prevent registration with duplicate email', () => {
    // Focus on business rules
  });
});
```

**Benefits:**
- Tests are more resilient to refactoring
- Clear documentation of system behavior
- Closer to user perspective

---

## Mocking and Test Doubles

### Types of Test Doubles

**Stub:** Returns predefined responses
```javascript
const userService = {
  getUser: () => ({ id: 1, name: 'Alice' })
};
```

**Mock:** Verifies interactions
```javascript
const emailService = {
  sendEmail: jest.fn()
};
// Later: expect(emailService.sendEmail).toHaveBeenCalledWith(...)
```

**Spy:** Wraps real object, records calls
```javascript
const spy = jest.spyOn(userService, 'getUser');
// Real method called, but we can verify
expect(spy).toHaveBeenCalled();
```

**Fake:** Simplified working implementation
```javascript
class FakeDatabase {
  constructor() {
    this.data = {};
  }
  save(id, value) {
    this.data[id] = value;
  }
  get(id) {
    return this.data[id];
  }
}
```

### When to Mock

**Mock external dependencies:**
- Database connections
- HTTP requests
- File system
- Third-party APIs
- Time (Date.now, setTimeout)

**Don't mock:**
- Code under test
- Simple value objects
- Internal implementation details

---

## Test Quality

### Characteristics of Good Tests

**FIRST Principles:**
- **Fast:** Run quickly (milliseconds for unit tests)
- **Independent:** Don't depend on other tests
- **Repeatable:** Same result every time
- **Self-Validating:** Clear pass/fail (no manual inspection)
- **Timely:** Written close to code (ideally before with TDD)

### Test Smells

**Flaky Tests:** Sometimes pass, sometimes fail
- Cause: Race conditions, timing dependencies, shared state
- Fix: Remove non-determinism, isolate tests

**Slow Tests:** Take too long to run
- Cause: Real network calls, database, complex setup
- Fix: Use mocks, optimize setup, move to integration suite

**Brittle Tests:** Break when implementation changes
- Cause: Testing implementation details, not behavior
- Fix: Focus on observable behavior, use public APIs

**Obscure Tests:** Hard to understand what's being tested
- Cause: Complex setup, unclear assertions, vague names
- Fix: Simplify, use AAA pattern, descriptive names

---

## Testing Checklist

### For Every Feature

- [ ] **Happy path tested** - Normal operation works
- [ ] **Edge cases tested** - Boundaries, empty values, special cases
- [ ] **Error cases tested** - Invalid input, failures handled
- [ ] **Security tested** - Auth required, validation present
- [ ] **Performance considered** - No obvious performance issues

### For Critical Features

- [ ] **Integration tests** - Components work together
- [ ] **E2E test for main flow** - Complete user journey works
- [ ] **Error recovery tested** - System handles failures gracefully
- [ ] **Concurrency tested** - Multiple users don't cause issues

### Test Code Quality

- [ ] **Tests are clear** - Easy to understand what's being tested
- [ ] **Tests are isolated** - Don't depend on each other
- [ ] **Tests are fast** - Unit tests run in milliseconds
- [ ] **Tests are reliable** - No flaky tests
- [ ] **Tests are maintainable** - Easy to update when code changes

---

## Manual Testing

### Exploratory Testing

**When automated tests aren't enough:**
- New features (before writing tests)
- UI/UX testing
- Discovering edge cases
- Usability issues

**Approach:**
1. Understand feature goals
2. Use application like a user would
3. Try unexpected actions
4. Look for errors, confusing UI, performance issues
5. Document findings

### Test Checklist for Manual Testing

**Functionality:**
- [ ] All features work as expected
- [ ] Error messages are clear and helpful
- [ ] Validation works correctly
- [ ] Data persists correctly

**UI/UX:**
- [ ] UI is responsive (mobile, tablet, desktop)
- [ ] Forms are easy to use
- [ ] Navigation is intuitive
- [ ] Loading states are clear
- [ ] Error states are clear

**Performance:**
- [ ] Pages load quickly
- [ ] No noticeable lag
- [ ] Large datasets handled well

**Cross-browser:**
- [ ] Works in major browsers (Chrome, Firefox, Safari, Edge)
- [ ] No console errors

---

## Testing Tools & Frameworks

### Popular Frameworks

**JavaScript:**
- Jest (all-in-one: runner, assertions, mocks)
- Mocha + Chai (flexible, composable)
- Vitest (fast, Vite-compatible)
- Playwright/Cypress (E2E)

**Python:**
- pytest (feature-rich, easy)
- unittest (built-in)
- Selenium (E2E)

**Java:**
- JUnit (standard)
- TestNG (flexible)
- Mockito (mocking)

### Coverage Tools

- Jest (built-in coverage)
- Istanbul/nyc (JavaScript)
- coverage.py (Python)
- JaCoCo (Java)

---

## Integration with Other Skills

**With role-code-review:** Review test quality and coverage
**With role-architect:** Ensure architecture is testable
**With role-security-auditor:** Write security-focused tests

---

## Quick Tips

- **Test behavior, not implementation** - Tests should survive refactoring
- **Keep tests simple** - Complex tests are hard to maintain
- **Write tests first (TDD)** - Forces better design
- **Fast feedback loop** - Unit tests should run in seconds
- **Don't aim for 100% coverage** - Focus on high-value tests
- **Mock external dependencies** - Keep tests fast and reliable
- **One assertion per test** - Makes failures clear
- **Descriptive test names** - Should explain what and why
