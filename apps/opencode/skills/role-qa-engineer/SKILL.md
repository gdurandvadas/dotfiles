---
name: role-qa-engineer
description: Load for test strategy design or edge case identification. Plans test organization and coverage evaluation.
license: MIT
compatibility: opencode
metadata:
  role: quality-assurance
  focus: testing
---

**Provides:** Test strategy planning, edge case identification, coverage evaluation, and test organization.

**Reference:** `standards-testing` for detailed testing patterns.

## Test Pyramid

Many unit tests (fast, cheap) -> some integration tests (medium) -> few E2E tests (slow, expensive)

## Test Levels

| Level | What | When | Speed |
|-------|------|------|-------|
| Unit | Individual functions in isolation | Business logic, utilities, validation | Fast (ms) |
| Integration | Component interactions | API endpoints, database ops, multi-component flows | Medium (s) |
| E2E | Complete user flows | Critical journeys (login, checkout) | Slow (min) |

## Coverage Goals

- **Critical paths** (auth, payments, data integrity): 100%
- **High-risk** (business logic, algorithms, error handling): 90%+
- **General code** (utilities, endpoints, services): 80%+

Don't aim for 100% everywhere -- diminishing returns. Focus on high-value tests.

## Edge Cases to Always Test

**Boundary values:** min, max, just inside/outside boundary
**Empty/null:** empty string, empty array, null, undefined, missing optional params
**Special characters:** unicode, SQL chars (`'`, `--`), HTML chars (`<`, `>`), whitespace
**Large inputs:** long strings, large arrays, deep nesting
**Timing:** concurrent operations, race conditions, timeouts

## Identifying Failure Points

Ask: What if this fails? What if the input is invalid? What if two users do this simultaneously? What if the external service is down? What if we run out of resources?

Common failure points: external APIs (network, timeout, rate limits), database (connection, deadlock, constraints), file system (permissions, disk space), user input (malformed, malicious).

## Test Quality (FIRST Principles)

- **Fast:** Milliseconds for unit tests
- **Independent:** No shared state between tests
- **Repeatable:** Same result every time
- **Self-Validating:** Clear pass/fail
- **Timely:** Written close to the code

## Test Smells

- **Flaky:** Remove non-determinism, isolate tests
- **Slow:** Use mocks for external deps, move heavy tests to integration suite
- **Brittle:** Test behavior not implementation, use public APIs
- **Obscure:** Simplify setup, use AAA pattern, descriptive names

## Mocking Guidelines

**Mock:** External dependencies (database, HTTP, file system, third-party APIs, time)
**Don't mock:** Code under test, simple value objects, internal implementation details

## Testing Checklist

### Every Feature
- [ ] Happy path tested
- [ ] Edge cases tested
- [ ] Error cases tested
- [ ] Input validation tested

### Critical Features
- [ ] Integration tests for component interaction
- [ ] E2E test for main user flow
- [ ] Error recovery tested
- [ ] Concurrency considered
