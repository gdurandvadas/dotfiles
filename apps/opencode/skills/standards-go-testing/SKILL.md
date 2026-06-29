---
name: standards-go-testing
description: MUST load when writing Go tests, benchmarks, or fuzz targets; SHOULD load for Go test reviews. Provides idiomatic Go testing patterns including table tests, subtests, testdata, fakes, benchmarks, and fuzzing.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: go-testing
  priority: high
---

# Go Testing Standards

**Provides:** Idiomatic Go testing patterns — table-driven tests, subtests, test helpers, deterministic time, golden files, fakes, benchmarks, and fuzz targets.

**Primary references:**

- [Effective Go](https://go.dev/doc/effective_go)
- [Go CodeReviewComments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
- [Google Go Style Guide](https://google.github.io/styleguide/go/guide) / [Decisions](https://google.github.io/styleguide/go/decisions) / [Best Practices](https://google.github.io/styleguide/go/best-practices)

> This skill adds Go-specific patterns; load `standards-testing` for general testing discipline (AAA pattern, coverage goals, what/what-not to test).

## Quick Reference

**Golden Rule**: Test behavior through the public API; inject dependencies so you can control them

**Do** (✅):
- Use table-driven tests for any function with multiple input/output cases
- Name every test case descriptively (`"empty_input_returns_error"`)
- Call `t.Helper()` as the first line of every helper function
- Use `t.Cleanup` for teardown in helpers (not bare `defer`)
- Inject `clock func() time.Time` or similar to avoid real-time dependencies
- Store expected output in `testdata/`; regenerate with `-update` flag
- Write handwritten fakes over heavy mocking frameworks
- Run `go test -race ./...` in CI

**Don't** (❌):
- Use `t.Fatal` in helpers without `t.Helper()` (failure points at helper, not caller)
- Share mutable state across parallel subtests
- Call `time.Sleep` in test assertions; use channels or context timeouts
- Use non-deterministic map iteration in golden-file output
- Include setup/teardown in the timed loop of a benchmark
- Start fuzzing targets that perform external I/O
- Use assertion libraries (`testify/assert`, etc.) — write plain comparisons instead
- Call `t.Fatal`/`t.FailNow` from goroutines — use `t.Error` and let the test continue
- Match errors by string (`err.Error() == "..."`) — use `errors.Is`/`errors.As`
- Put complex conditional mock setup inside table tests — split into focused functions
- Use slashes in subtest names — they break `-run` filtering
- Run expensive setup in global `init()` — scope it to the tests that need it

**Key Commands:**

```bash
go test ./...                              # run all tests
go test -race ./...                        # detect data races
go test -cover ./...                       # coverage report
go test -bench . -benchmem ./...           # benchmarks with alloc stats
go test -fuzz=FuzzX -fuzztime=30s ./pkg    # fuzz for 30 seconds
go test -run TestX -count=100 ./pkg        # stress test for flakiness
go test ./integration/...                  # run integration tests from dedicated folder
go test -cpuprofile cpu.out -memprofile mem.out -bench . ./pkg  # profile during benchmarks
```

---

## Useful Failure Messages

Test failures must be diagnosable without reading the source. Every `t.Errorf`/`t.Fatalf` call should include: function name + inputs, actual result, expected result — in that order.

**Canonical format:** `YourFunc(%v) = %v, want %v`

- **Got before want** — always print actual before expected (matches `cmp.Diff` convention).
- **Include inputs** — `t.Errorf("Add(2, 3) = %d, want %d", got, 5)` is far more useful than `t.Errorf("got %d, want %d", got, 5)`.
- **t.Error vs t.Fatal** — use `t.Error` to keep the test running so all failures are reported; use `t.Fatal` only when continuing is meaningless (e.g., setup failed, decoding invalid output is pointless).
- **Never call `t.Fatal`/`t.FailNow` from a goroutine** — only the test goroutine may call them; use `t.Error` from spawned goroutines.

```go
// ✅ Canonical format — function name + inputs + got + want
if got := Add(2, 3); got != 5 {
    t.Errorf("Add(2, 3) = %d, want %d", got, 5)
}

// ✅ Use t.Error to report multiple failures in one run
if diff := cmp.Diff(wantMean, gotMean); diff != "" {
    t.Errorf("Mean() mismatch (-want +got):\n%s", diff)
}
if diff := cmp.Diff(wantVariance, gotVariance); diff != "" {
    t.Errorf("Variance() mismatch (-want +got):\n%s", diff)
}

// ✅ t.Fatal when continuation is pointless
gotEncoded := Encode(input)
if gotEncoded != wantEncoded {
    t.Fatalf("Encode(%q) = %q, want %q", input, gotEncoded, wantEncoded)
}
// Decoding unexpected output is meaningless, so Fatal above is justified

// ❌ Bad: no function name or inputs — impossible to diagnose
if got := Add(2, 3); got != 5 {
    t.Errorf("got %d, want %d", got, 5)
}
```

---

## Comparisons & Assertions

**No assertion libraries.** Do not use `testify/assert`, `testify/require`, or similar. They fragment the developer experience and often produce unhelpful messages. Write plain `if got != want` comparisons.

**Use `cmp.Diff` for complex types** (structs, slices, maps). Always include the direction key `(-want +got)` in the error message so the reader knows which side is which.

**Use `errors.Is`/`errors.As` for error semantics** — never compare error strings; they are not part of the API contract and break silently on wording changes.

```go
// ✅ Struct/slice comparison with cmp.Diff
want := &Post{Type: "blog", Comments: 2}
if diff := cmp.Diff(want, got); diff != "" {
    t.Errorf("GetPost() mismatch (-want +got):\n%s", diff)
}

// ✅ Protocol buffers
if diff := cmp.Diff(want, got, protocmp.Transform()); diff != "" {
    t.Errorf("Foo() mismatch (-want +got):\n%s", diff)
}

// ✅ Error semantics
if !errors.Is(err, ErrInvalidInput) {
    t.Errorf("f(%v) error = %v, want ErrInvalidInput", input, err)
}

// ✅ errors.As to inspect the concrete error type
var target *ValidationError
if !errors.As(err, &target) {
    t.Errorf("f(%v) error = %v, want *ValidationError", input, err)
}

// ❌ Assertion library — don't
assert.IsNotNil(t, "obj", obj)
assert.StringEq(t, "obj.Type", obj.Type, "blogPost")

// ❌ String-matching errors — brittle
if err.Error() != "invalid input" {
    t.Errorf("unexpected error: %v", err)
}
```

---

## Table-Driven Tests & Subtests

Table-driven tests are the canonical Go style for any function with more than one meaningful scenario.

- Multiple inputs/outputs or scenarios for the same function.
- Declare `[]struct{ name, input, want }` slice; iterate with `t.Run(tc.name, func(t *testing.T) { ... })`. Name every case descriptively. Avoid shared mutable fixtures across cases. `t.Parallel()` can be called inside `t.Run` to run subtests concurrently when: (a) all test cases are read-only (no shared mutable fixtures), (b) Go 1.22+ is used (loop variable is per-iteration so no capture needed), or (c) on older toolchains the `tc := tc` capture is added before `t.Parallel()`.
- Loop-variable capture in closures (pre-Go 1.22) — add `tc := tc` inside the loop body when `t.Parallel()` is used on older toolchains.
- Calling `t.Parallel()` with shared mutable state causes data races.
- Unnamed or numbered cases make failures impossible to diagnose at a glance.
- `go test ./...`; target a single case with `go test -run TestX/case_name`; run `-count=100` to surface flakiness.

```go
// ✅ Idiomatic table-driven test
func TestAdd(t *testing.T) {
    cases := []struct {
        name    string
        a, b    int
        want    int
    }{
        {"positive",      2,  3,  5},
        {"negative",     -1,  1,  0},
        {"zero_identity", 0,  0,  0},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            if got := Add(tc.a, tc.b); got != tc.want {
                t.Errorf("Add(%d, %d) = %d; want %d", tc.a, tc.b, got, tc.want)
            }
        })
    }
}

// ❌ Anti-pattern: unnamed cases, no subtest
func TestAdd_Bad(t *testing.T) {
    if Add(2, 3) != 5 { t.Error("failed") }
    if Add(-1, 1) != 0 { t.Error("failed") } // which case failed?
}
```

```go
// ✅ Safe parallel subtests (Go 1.22+ — loop variable is per-iteration)
for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
        t.Parallel() // safe: tc is a fresh copy each iteration in Go 1.22+
        got := Add(tc.a, tc.b)
        if got != tc.want {
            t.Errorf("Add(%d, %d) = %d; want %d", tc.a, tc.b, got, tc.want)
        }
    })
}

// ✅ Safe parallel subtests (pre-Go 1.22 — explicit capture)
for _, tc := range cases {
    tc := tc // capture loop variable before calling t.Parallel
    t.Run(tc.name, func(t *testing.T) {
        t.Parallel()
        got := Add(tc.a, tc.b)
        if got != tc.want {
            t.Errorf("Add(%d, %d) = %d; want %d", tc.a, tc.b, got, tc.want)
        }
    })
}
```

### Avoid Complexity in Table Tests

When test cases require conditional mock setup, multiple branching fields, or case-specific teardown, **split into separate focused test functions** instead of growing the table.

A table test works well when: all cases run identical logic, setup is uniform, no conditional assertions, and every field is used in every case. A single `wantErr bool` field is acceptable; a matrix of `shouldCallX`, `giveXResponse`, `giveXErr` flags is not.

```go
// ❌ Too complex — conditional fields and mock branching
tests := []struct {
    give        string
    shouldCallX bool
    giveXErr    error
    wantErr     bool
}{...}
for _, tt := range tests {
    t.Run(tt.give, func(t *testing.T) {
        if tt.shouldCallX {
            xMock.EXPECT().Call().Return("resp", tt.giveXErr)
        }
        // ...
    })
}

// ✅ Split into focused functions instead
func TestCallsX_OnValidInput(t *testing.T) { ... }
func TestReturnsError_WhenXFails(t *testing.T) { ... }
```

### Subtest Names

- Keep names short and stable: `"empty_input"`, `"hu_to_en"` — not `"should return error when input is empty"`.
- **Avoid slashes** in subtest names — `/` is the path separator in `-run` patterns; a name like `"a/b"` creates a nested subtest and breaks filtering.
- Names should be filter-friendly: `go test -run TestTranslate/hu_to_en` must work.

---

## Test Helpers & t.Helper

Shared assertion and setup logic belongs in helper functions, not duplicated across tests.

- Two or more tests need the same setup, teardown, or assertion logic.
- Call `t.Helper()` as the **first statement**. Accept `*testing.T` as the first parameter. Use `t.Cleanup(fn)` for teardown so it runs regardless of test outcome; do not rely on bare `defer` in helpers (it may not run on `t.Fatal`).
- Omitting `t.Helper()` causes failure output to point at the helper body instead of the caller — forces a confusing stack hunt.
- Global test state not reset via `t.Cleanup` leaks across tests when run with `-count` or in parallel.
- After a deliberate failure, the error message cites the **caller** line, not a line inside the helper.

```go
// ✅ Correct helper
func requireNoError(t *testing.T, err error) {
    t.Helper()
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
}

// ✅ Helper with cleanup
func tempDir(t *testing.T) string {
    t.Helper()
    dir := t.TempDir() // t.TempDir already registers cleanup
    return dir
}

// ❌ Missing t.Helper() — failure line points into this function, not the caller
func badHelper(t *testing.T, err error) {
    if err != nil {
        t.Fatalf("error: %v", err) // confusing output
    }
}
```

---

## Deterministic Time & Randomness

Tests that depend on wall-clock time or randomness are inherently flaky.

- Production code calls `time.Now()`, uses random numbers, or sleeps.
- Inject a `clock func() time.Time` parameter or a `Clock` interface. Seed deterministic `rand` using a fixed value in tests. Replace `time.Sleep` with channel signals or context deadlines that tests can trigger immediately.
- Real `time.Sleep` makes tests slow and racy on loaded CI machines.
- Tests that assert specific wall-clock times break across time zones or DST.
- Race conditions arise when timers fire before assertions complete.
- Run `go test -run TestX -count=100 ./pkg` stably on CI; grep for `time.Sleep` in `_test.go` files and justify each occurrence.

```go
// ✅ Inject clock for determinism
type Service struct {
    clock func() time.Time
}

func NewService() *Service   { return &Service{clock: time.Now} }
func newTestService() *Service { return &Service{clock: func() time.Time { return fixedTime }} }

// ❌ Hard-coded wall clock — untestable
func (s *Service) IsExpired(t time.Time) bool {
    return time.Now().After(t) // cannot control in tests
}
```

---

## Golden Files & testdata

Golden files decouple test assertions from large or complex expected output.

- Testing functions that produce large structured output: JSON, HTML, SQL, rendered templates, or binary formats.
- Store expected output under `testdata/` (Go tooling ignores this directory during builds). Accept a `-update` flag to regenerate golden files when behavior intentionally changes. Diff actual vs. golden with clear output. Use deterministic serialization (sorted map keys, stable marshalling).
- Non-deterministic map iteration produces different output each run, causing spurious failures.
- Platform-dependent line endings (`\r\n` vs `\n`) break cross-platform runs.
- Forgetting to commit updated golden files after an intentional change breaks CI.
- `go test ./...` passes on Linux, macOS, and Windows; golden files are tracked in version control.

```go
var update = flag.Bool("update", false, "regenerate golden files")

func TestRender(t *testing.T) {
    got := Render(input)
    golden := filepath.Join("testdata", "render.golden")
    if *update {
        os.WriteFile(golden, got, 0644)
    }
    want, _ := os.ReadFile(golden)
    if !bytes.Equal(got, want) {
        t.Errorf("output mismatch (-want +got):\n%s", diff(want, got))
    }
}
```

---

## Fakes vs Mocks

Prefer handwritten fakes that implement the interface over auto-generated or framework mocks.

- Testing code that calls an interface — databases, HTTP clients, clocks, queues.
- Write a small struct that implements the interface; record calls if needed; assert on *behavior* (did the right thing happen?), not on *internal sequence* (was method X called before Y?). Define interfaces at the **point of use**, as narrow as needed.
- Over-mocking makes tests brittle: they break on refactoring even when behavior is unchanged.
- Framework-generated mocks that don't reflect real behavior give false confidence.
- Test-specific interfaces that are too wide force fakes to implement unused methods.
- Tests survive refactoring of the internal implementation without changes to the test itself. Fakes compile when the interface changes (compiler enforces sync).

```go
// ✅ Handwritten fake
type fakeStore struct {
    users map[string]*User
    err   error // inject error for unhappy-path tests
}

func (f *fakeStore) Get(_ context.Context, id string) (*User, error) {
    if f.err != nil { return nil, f.err }
    return f.users[id], nil
}

// ❌ Over-specified mock — breaks on any internal reordering
mockStore.EXPECT().Get(ctx, "42").Times(1).Return(user, nil)
mockStore.EXPECT().Save(ctx, user).Times(1).Return(nil)
```

### Test Double Naming & Packages

- **Package:** put shared test doubles in a package named `<pkg>test` (e.g., `creditcardtest`). This keeps them out of production binaries and importable by external test packages.
- **Single double:** a simple unexported struct or `Stub` is fine.
- **Multiple behaviors:** name by behavior — `AlwaysCharges`, `AlwaysDeclines` — so call-sites are self-documenting.
- **Multiple types:** include the type — `StubService`, `StubStoredValue`.
- **Local variables:** prefix double variables for clarity (`spyCC` not `cc`).

```go
// Package creditcardtest
type AlwaysCharges struct{}
func (AlwaysCharges) Charge(*creditcard.Card, money.Money) error { return nil }

type AlwaysDeclines struct{}
func (AlwaysDeclines) Charge(*creditcard.Card, money.Money) error {
    return creditcard.ErrDeclined
}
```

### Test Package Choice

| Declaration | Use case |
|---|---|
| `package foo` | White-box testing — can access unexported identifiers |
| `package foo_test` | Black-box testing — only public API; also breaks import cycles |

Both styles live in `foo_test.go` files. Prefer `package foo_test` for external API tests and to avoid circular imports; use `package foo` when you need to test unexported helpers directly.

### Setup Scoping

Avoid `init()` or package-level `var` that load expensive fixtures for **all** tests. Scope setup to the tests that need it using helper functions; tests that don't need the data pay nothing.

```go
// ✅ Explicit per-test setup
func TestParseData(t *testing.T) {
    data := mustLoadDataset(t) // only this test pays for it
    // ...
}

// ❌ Global init — runs even for unrelated tests
var dataset []byte
func init() { dataset = mustLoadDataset() }
```

---

## Testable Examples

Testable examples serve as live documentation that `go test` verifies on every run.

- Public API functions where live documentation showing expected output would help users. Examples appear in `go doc` and `pkg.go.dev`.
- Name functions `func ExampleFoo()` or `func ExampleFoo_suffix()` for multiple examples.
- Add an `// Output:` comment at the end with the exact expected stdout. If output order is non-deterministic, use `// Unordered output:`.
- Keep examples self-contained; import only what's needed.
- Without an `// Output:` comment the function compiles but does not run as a test.
- Non-deterministic output (map iteration, timestamps, random data) causes test failures — stabilize or avoid.
- Omitting `// Output:` means the example is never executed — tests pass vacuously.
- Examples that import heavy dependencies inflate package test binaries.
- `go test ./...` runs and passes the example; `go doc PackageName.Foo` shows the example in the rendered docs.

```go
// ✅ Testable example with Output comment
func ExampleGreet() {
    fmt.Println(Greet("world"))
    // Output:
    // Hello, world!
}

// ✅ Multiple examples for the same function
func ExampleGreet_formal() {
    fmt.Println(Greet("Dr. Smith"))
    // Output:
    // Hello, Dr. Smith!
}
```

---

## Integration Tests

Integration tests exercise real external dependencies and are kept separate so they do not slow down every `go test ./...` run.

- Tests that require real external dependencies (databases, network services, file system), are slow, or are designed to run only in dedicated environments.
- Prefer a dedicated `integration/` subdirectory (with its own package like `package integration_test`) and run it explicitly: `go test ./integration/...`. This keeps the scope obvious to both humans and tooling.
- When keeping integration tests alongside unit tests, use a `_integration_test.go` suffix so the file stands out in listings. Run them via targeted commands such as `go test -run TestIntegration ./...` or `go test ./pkg -run TestIntegration`.
- Name your test functions with an `Integration` prefix/suffix (e.g., `TestIntegration_CreateOrder`) and group variants with `t.Run` to make filtering reliable.
- Guard slow tests with `testing.Short()` so the default `go test ./...`/CI run skips them (`if testing.Short() { t.Skip("skipping integration test") }`). Run the full suite with `go test -run TestIntegration ./...` or `go test -short ./...` to skip slow tests explicitly.
- Keep cleanup localized (`t.Cleanup`, `t.TempDir`, or `defer`) and avoid hardcoding connection strings — inject via environment variables or dedicated test configs.
- Build-tagged tests (`//go:build integration`) are a last resort when a test must be hidden from `go test ./...` entirely (destructive operations, credentials that must never run accidentally). They are harder to discover and require extra CLI flags, so document why the tag is necessary when you do use it.

```go
package integration_test

import (
    "os"
    "testing"
)

func TestIntegration_DatabaseRoundTrip(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }

    dsn := os.Getenv("TEST_DSN")
    if dsn == "" {
        t.Skip("TEST_DSN not set; skip real database")
    }

    // ... test body using real DB
    t.Cleanup(func() { /* teardown */ })
}
```

---

## E2E Tests

E2E tests target the full running system — a compiled binary, live cluster, or external service — and are always kept in a dedicated location separate from unit and integration tests.

- Use a top-level `e2e/` or `test/e2e/` directory with its own package (`package e2e_test`). Run explicitly: `go test ./e2e/...`.
- Gate execution with an environment variable rather than `testing.Short()` (which signals "slow", not "system-under-test"): `if os.Getenv("RUN_E2E") == "" { t.Skip("set RUN_E2E to run") }`.
- Build tags (`//go:build e2e`) are acceptable here — e2e tests often require special infrastructure or credentials that must never run accidentally. Pair with the env guard for double safety.
- Use `t.Cleanup` for teardown; propagate `context` with a deadline to bound runaway tests.

```go
// e2e/api_test.go — package e2e_test
package e2e_test

import (
    "os"
    "testing"
)

func TestE2E_CreateOrder(t *testing.T) {
    if os.Getenv("RUN_E2E") == "" {
        t.Skip("set RUN_E2E=1 to run e2e tests")
    }
    // ... drive the running system
    t.Cleanup(func() { /* teardown */ })
}
```

---

## Benchmarks & -benchmem

Benchmarks are first-class tests in Go; use them to guard performance-sensitive paths.

- Performance-critical code paths, allocation budgets, or before/after comparison of an optimization.
- Write `func BenchmarkX(b *testing.B)`. Call `b.ResetTimer()` after any setup. Use `b.ReportAllocs()` (or pass `-benchmem`) to surface heap allocations. Assign results to a package-level sink to prevent the compiler from eliminating the call. In Go 1.24+, prefer `b.Loop()` over `for i := 0; i < b.N; i++`. Use `b.RunParallel(func(pb *testing.PB) { for pb.Next() { ... } })` to benchmark concurrent throughput or measure lock contention. Call `b.SetParallelism(n)` to control goroutine count if needed.
  - Use `b.Run("name", func(b *testing.B) { ... })` to group related benchmark variants (e.g., different input sizes or encoding formats) under one parent — results appear in a hierarchy and can be filtered individually with `-bench=BenchmarkX/name`.
- Including setup/teardown inside the timed loop inflates `ns/op`.
- High-variance I/O (disk, network) makes `ns/op` unstable.
- Not sinking the result lets the compiler optimize away the call, reporting unrealistically low numbers.
- Stable `ns/op` and `allocs/op` across runs; compare before/after with `benchstat`.

```go
var sink any // package-level sink prevents dead-code elimination

// ✅ Idiomatic benchmark (Go 1.24+)
func BenchmarkProcess(b *testing.B) {
    data := makeTestData()  // setup outside timer
    b.ResetTimer()
    b.ReportAllocs()
    for b.Loop() {          // b.Loop() preferred in 1.24+
        sink = Process(data)
    }
}

// ✅ Pre-1.24 style
func BenchmarkProcessOld(b *testing.B) {
    data := makeTestData()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        sink = Process(data)
    }
}
```

```go
// ✅ Parallel benchmark — measures concurrent throughput / contention
func BenchmarkProcessParallel(b *testing.B) {
    data := makeTestData()
    b.ResetTimer()
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            sink = Process(data)
        }
    })
}

// ✅ Sub-benchmarks — compare two encoding formats
func BenchmarkEncode(b *testing.B) {
    data := makeTestData()

    b.Run("JSON", func(b *testing.B) {
        b.ReportAllocs()
        for b.Loop() {
            sink, _ = json.Marshal(data)
        }
    })

    b.Run("MessagePack", func(b *testing.B) {
        b.ReportAllocs()
        for b.Loop() {
            sink, _ = msgpack.Marshal(data)
        }
    })
}
// Run a specific sub-benchmark: go test -bench=BenchmarkEncode/JSON -benchmem ./...
```

---

## Fuzz Testing

Fuzz testing finds unexpected inputs that panic or violate invariants — critical for parsers and decoders.

- Parsing, decoding, or validating untrusted input: JSON, binary protocols, URLs, user-supplied strings.
- Write `func FuzzX(f *testing.F)`. Seed the corpus with `f.Add(...)` covering known edge cases. Assert invariants inside the fuzz body (no panic, output is valid, round-trip is stable). Store interesting corpus entries the fuzzer finds in `testdata/fuzz/FuzzX/`.
- No seed corpus means early fuzzing is purely random and slow to find interesting paths.
- Slow fuzz targets (>1 ms/exec) block CI; keep the target tight and pure.
- External I/O (network, disk) inside a fuzz target makes it non-reproducible.
- `go test -fuzz=FuzzX -fuzztime=30s ./pkg` exits cleanly; corpus entries committed; seed-corpus run (`go test ./...`) produces no panics.

```go
func FuzzParseConfig(f *testing.F) {
    // Seed with known edge cases
    f.Add([]byte(`{}`))
    f.Add([]byte(`{"key":"value"}`))
    f.Add([]byte(nil))

    f.Fuzz(func(t *testing.T, data []byte) {
        cfg, err := ParseConfig(data)
        if err != nil {
            return // errors are fine; panics are not
        }
        // Invariant: re-serializing produces parseable output
        out, err := cfg.Marshal()
        if err != nil {
            t.Errorf("marshal of valid config failed: %v", err)
        }
        if _, err := ParseConfig(out); err != nil {
            t.Errorf("round-trip failed: %v", err)
        }
    })
}
```

---

## Skill Loading Triggers

| Situation | Also load |
|---|---|
| Writing any Go tests | `standards-testing` |
| Writing benchmarks | `standards-go-performance` |
| Testing concurrent code | `standards-go-concurrency` |
| Reviewing Go tests | `role-code-review` |

## Verification Checklist

> For baseline formatting, vet, and go test checks see `standards-go`.

- [ ] Table-driven tests used for functions with multiple cases; each case has a descriptive name
- [ ] `t.Helper()` called as first line of every test helper function
- [ ] `t.Cleanup` used for teardown (not bare defer in helpers)
- [ ] Failure messages include function name + inputs + got + want; `t.Error` used for multiple assertions
- [ ] `t.Fatal`/`t.FailNow` never called from goroutines
- [ ] No assertion libraries — plain comparisons or `cmp.Diff` used; errors compared with `errors.Is`/`errors.As`
- [ ] Fakes used instead of heavy mocking frameworks; fake types compile after interface changes
- [ ] No `time.Sleep` in test assertions; clock injected for determinism
- [ ] Benchmarks exclude setup from timed loop (`b.ResetTimer`); `b.Loop()` used on Go 1.24+
- [ ] Fuzz targets have seeded corpus; no external I/O inside fuzz body
- [ ] Integration tests reside in dedicated folders (e.g., `integration/`) or `_integration_test.go` files with `Integration`-prefixed names, are targeted via commands such as `go test ./integration/...` or `go test -run TestIntegration ./...`, and skip by default using `testing.Short()` when appropriate
- [ ] E2E tests live in a top-level `e2e/` or `test/e2e/` directory, are gated by an environment variable (`RUN_E2E`), and never run as part of `go test ./...`
- [ ] Example functions have `// Output:` comment so they run as tests

Note: file list is sampled.
