---
name: standards-rust-testing
description: MUST load when writing Rust tests, benchmarks, or property tests; SHOULD load for Rust test reviews. Provides idiomatic Rust testing patterns including unit tests, integration tests, doctests, property-based testing, benchmarks, fuzzing, and snapshot testing.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: rust-testing
  priority: high
---

# Rust Testing Standards

**Provides:** Idiomatic Rust testing patterns — unit tests with `#[cfg(test)]`, integration tests, doctests, test fixtures with RAII, property-based testing with proptest, benchmarks with criterion, fuzzing with cargo-fuzz, and snapshot testing with insta.

**Primary references:**

- [The Rust Programming Language — Testing](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Criterion.rs](https://bheisler.github.io/criterion.rs/book/)
- [Proptest Book](https://proptest-rs.github.io/proptest/intro.html)

> This skill adds Rust-specific patterns; load `standards-testing` for general testing discipline (AAA pattern, coverage goals, what/what-not to test).

## Quick Reference

**Golden Rule**: Test behavior through the public API; use the type system to make test setup obvious and teardown automatic.

**Do:**

- Write unit tests in `#[cfg(test)] mod tests` alongside production code
- Put integration tests in `tests/` directory — they test the public API
- Include `# Examples` code blocks in doc comments (doctests run as tests)
- Use descriptive test names: `test_parse_returns_error_on_empty_input`
- Use RAII fixtures (`Drop` impl) for automatic cleanup
- Use `assert_eq!` / `assert_ne!` with custom messages including inputs
- Test error conditions with `Result`-returning tests and `#[should_panic]`
- Use proptest for algorithmic / parser code
- Run `cargo test --all-features` in CI
- Use `#[ignore]` for slow tests; run with `cargo test -- --ignored`

**Don't:**

- Use `unwrap()` in test assertions without context — use `expect("reason")` or assert macros
- Share mutable state across tests — each test must be independent
- Rely on test execution order — tests run in parallel by default
- Test private implementation details — test through the public API
- Use `println!` for test verification — use assertions
- Mock what you can fake — handwritten fakes over heavy mock frameworks
- Ignore doctests — they verify that examples in documentation actually compile and run

**Key commands:**

```sh
cargo test                                 # all tests (unit + integration + doc)
cargo test --lib                           # unit tests only
cargo test --doc                           # doctests only
cargo test --test integration_test         # specific integration test file
cargo test test_name                       # filter by name
cargo test -- --nocapture                  # show stdout/stderr
cargo test -- --ignored                    # run #[ignore] tests
cargo test -- --test-threads=1             # sequential execution
cargo bench                                # criterion benchmarks
cargo fuzz run target_name                 # run fuzzer
cargo insta test                           # snapshot tests
cargo insta review                         # review snapshot changes
cargo llvm-cov --html                      # coverage report
cargo tarpaulin --out Html                 # alternative coverage
```

---

## Unit Tests

Unit tests live in a `#[cfg(test)]` module inside the source file. They have access to private items in the parent module.

```rust
pub fn add(a: i32, b: i32) -> i32 { a + b }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positive_numbers() {
        assert_eq!(add(2, 3), 5);
    }

    #[test]
    fn negative_numbers() {
        assert_eq!(add(-2, -3), -5, "add({}, {}) should be {}", -2, -3, -5);
    }
}
```

### Useful Failure Messages

Every assertion should be diagnosable without reading the source. Include the function name, inputs, actual and expected values:

```rust
// Good — inputs and expected value in message
assert_eq!(parse("42"), Ok(42), "parse({:?}) failed", "42");

// Bad — no context
assert!(result.is_ok());
```

### Result-Returning Tests

Use `Result<(), E>` return type to propagate errors with `?`:

```rust
#[test]
fn parse_valid_config() -> Result<(), Box<dyn std::error::Error>> {
    let config = parse_config("key=value")?;
    assert_eq!(config.get("key"), Some(&"value".to_string()));
    Ok(())
}
```

### Testing Panics

```rust
#[test]
#[should_panic(expected = "index out of bounds")]
fn panics_on_out_of_bounds() {
    let v = vec![1, 2, 3];
    let _ = v[10];
}
```

### Nested Test Modules

Group related tests with nested modules:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    mod parsing {
        use super::*;

        #[test]
        fn valid_input() { /* ... */ }

        #[test]
        fn empty_input() { /* ... */ }
    }

    mod validation {
        use super::*;

        #[test]
        fn rejects_negative() { /* ... */ }
    }
}
```

Run a specific group: `cargo test tests::parsing`.

---

## Test Fixtures with RAII

Use structs with `Drop` for automatic cleanup. No explicit teardown needed.

```rust
struct TestDb {
    pool: PgPool,
    db_name: String,
}

impl TestDb {
    async fn setup() -> Self {
        let db_name = format!("test_{}", uuid::Uuid::new_v4());
        let pool = create_test_db(&db_name).await;
        Self { pool, db_name }
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        // Cleanup runs automatically when the test ends
        drop_test_db(&self.db_name);
    }
}

#[tokio::test]
async fn user_roundtrip() {
    let db = TestDb::setup().await;
    // test uses db.pool ...
    // Drop cleans up automatically
}
```

For simple temp directories, use `tempfile::TempDir` — it cleans up on drop.

---

## Integration Tests

Integration tests live in `tests/` and test the crate's public API as an external consumer.

```
tests/
├── integration_test.rs     # standalone test file
└── common/
    └── mod.rs              # shared test utilities
```

```rust
// tests/integration_test.rs
use my_crate::Config;

#[test]
fn full_workflow() {
    let config = Config::from_str("host=localhost").unwrap();
    assert_eq!(config.host(), "localhost");
}

// tests/common/mod.rs — shared helpers
pub fn test_config() -> my_crate::Config {
    my_crate::Config::from_str("host=test").unwrap()
}

// tests/another_test.rs
mod common;

#[test]
fn uses_shared_helper() {
    let config = common::test_config();
    assert!(config.is_valid());
}
```

Each file in `tests/` is compiled as a separate crate. Group related tests in one file to share setup code without a `common/` module.

---

## Doctests

Doc comments with code blocks are compiled and run as tests. They serve as verified documentation.

```rust
/// Adds two numbers.
///
/// # Examples
///
/// ```
/// use my_crate::add;
/// assert_eq!(add(2, 3), 5);
/// ```
///
/// # Panics
///
/// Panics if the result overflows.
pub fn add(a: i32, b: i32) -> i32 {
    a.checked_add(b).expect("overflow")
}
```

Use `should_panic` and `compile_fail` annotations for negative examples:

```rust
/// ```should_panic
/// my_crate::divide(1, 0);
/// ```
///
/// ```compile_fail
/// let x: u32 = -1; // won't compile
/// ```
```

**Pitfalls:**
- Without a code block, there is no doctest — the doc comment is pure prose.
- Hidden lines (`# use ...;`) keep examples focused without cluttering the rendered docs.

---

## Async Tests

Use `#[tokio::test]` for async test functions:

```rust
#[tokio::test]
async fn fetches_data() {
    let result = fetch_data("https://example.com").await;
    assert!(result.is_ok());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn concurrent_test() {
    let (a, b) = tokio::join!(task_a(), task_b());
    assert!(a.is_ok());
    assert!(b.is_ok());
}
```

Use `tokio::time::timeout` to prevent async tests from hanging:

```rust
#[tokio::test]
async fn completes_in_time() {
    let result = tokio::time::timeout(
        Duration::from_secs(5),
        slow_operation(),
    ).await;
    assert!(result.is_ok(), "operation timed out");
}
```

---

## Property-Based Testing (proptest)

Test properties that hold for all inputs, not just specific examples. Catches edge cases that hand-written tests miss.

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn reversing_twice_is_identity(ref s in "\\PC*") {
        let reversed: String = s.chars().rev().collect();
        let double_reversed: String = reversed.chars().rev().collect();
        prop_assert_eq!(s, &double_reversed);
    }

    #[test]
    fn addition_is_commutative(a in 0..1000i32, b in 0..1000i32) {
        prop_assert_eq!(a + b, b + a);
    }
}
```

Custom strategies for domain types:

```rust
fn user_strategy() -> impl Strategy<Value = User> {
    (1..1000u64, "[a-z]{3,10}", "[a-z0-9.]+@[a-z]+\\.[a-z]+")
        .prop_map(|(id, name, email)| User { id, name, email })
}

proptest! {
    #[test]
    fn user_serialization_roundtrip(user in user_strategy()) {
        let json = serde_json::to_string(&user).unwrap();
        let deserialized: User = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(user, deserialized);
    }
}
```

**Pitfalls:**
- Slow strategies (network, disk) make proptest impractical — keep targets pure.
- Failed seeds are saved in `proptest-regressions/` — commit these files to prevent regressions.

---

## Fakes Over Mocks

Prefer handwritten fakes that implement the trait over mock frameworks. Fakes are simpler, survive refactoring, and the compiler ensures they stay in sync with the trait.

```rust
// Trait defined at point of use
trait UserStore {
    fn get(&self, id: u64) -> Option<User>;
}

// Handwritten fake
struct FakeUserStore {
    users: HashMap<u64, User>,
    error: Option<String>,
}

impl UserStore for FakeUserStore {
    fn get(&self, id: u64) -> Option<User> {
        self.users.get(&id).cloned()
    }
}

#[test]
fn returns_none_for_missing_user() {
    let store = FakeUserStore { users: HashMap::new(), error: None };
    assert_eq!(store.get(42), None);
}
```

Use `mockall` only when the trait has many methods and writing a full fake is disproportionate.

---

## Benchmarks with Criterion

```rust
// benches/my_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_parse(c: &mut Criterion) {
    let input = generate_test_input();

    c.bench_function("parse", |b| {
        b.iter(|| parse(black_box(&input)))
    });
}

fn benchmark_sizes(c: &mut Criterion) {
    let mut group = c.benchmark_group("sort");
    for size in [10, 100, 1000, 10_000] {
        group.bench_with_input(
            criterion::BenchmarkId::from_parameter(size),
            &size,
            |b, &size| {
                b.iter_batched(
                    || generate_random_vec(size),
                    |mut v| v.sort(),
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }
    group.finish();
}

criterion_group!(benches, benchmark_parse, benchmark_sizes);
criterion_main!(benches);
```

Add to `Cargo.toml`:

```toml
[dev-dependencies]
criterion = "0.5"

[[bench]]
name = "my_benchmark"
harness = false
```

**Pitfalls:**
- Including setup in the timed loop inflates `ns/op` — use `iter_batched` or setup before the closure.
- `black_box` prevents the compiler from optimizing away the computation.
- Compare before/after with `cargo bench -- --save-baseline before` then `critcmp`.

---

## Fuzzing

Use `cargo-fuzz` (libFuzzer) for security-critical parsers and decoders:

```rust
// fuzz/fuzz_targets/fuzz_parser.rs
#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if let Ok(s) = std::str::from_utf8(data) {
        let _ = my_crate::parse(s);
    }
});
```

```sh
cargo fuzz init                            # scaffold fuzz targets
cargo fuzz run fuzz_parser -- -max_len=4096  # run with size limit
cargo fuzz run fuzz_parser -- -jobs=4       # parallel fuzzing
```

**Pitfalls:**
- No external I/O inside fuzz targets — must be pure and deterministic.
- Commit interesting corpus entries from `fuzz/corpus/` to prevent regression.

---

## Snapshot Testing with insta

For large or complex output, assert against stored snapshots:

```rust
use insta::assert_snapshot;

#[test]
fn renders_report() {
    let report = generate_report(&test_data());
    assert_snapshot!(report);
}

#[test]
fn serializes_config() {
    let config = Config::default();
    insta::assert_json_snapshot!(config);
}
```

```sh
cargo insta test                           # run tests, generate new snapshots
cargo insta review                         # interactive review of changes
```

Snapshots are stored in `snapshots/` directories next to the test file. Commit them to version control.

---

## Code Coverage

```sh
# Using cargo-llvm-cov (recommended)
cargo llvm-cov --html --open

# Using tarpaulin
cargo tarpaulin --out Html --output-dir coverage

# CI-friendly — fail if below threshold
cargo llvm-cov --fail-under-lines 80
```

---

## Skill Loading Triggers

| Situation | Also load |
|-----------|-----------|
| Writing any Rust tests | `standards-testing` |
| Writing async tests | `standards-rust-async` |
| Writing benchmarks, profiling | `standards-rust` |
| Reviewing Rust tests | `role-code-review` |

## Verification Checklist

> For baseline formatting, clippy, and cargo test checks see `standards-rust`.

- [ ] Unit tests in `#[cfg(test)]` modules alongside production code
- [ ] Integration tests in `tests/` directory test only the public API
- [ ] Doc comments on public items include `# Examples` with runnable code blocks
- [ ] `cargo test --all-features` passes (unit + integration + doctests)
- [ ] Assertion messages include function name, inputs, and expected values
- [ ] RAII fixtures used for cleanup — no manual teardown
- [ ] Proptest used for algorithmic / parser code; regression seeds committed
- [ ] Benchmarks use criterion with `black_box`; setup excluded from timed loop
- [ ] Fuzz targets exist for security-critical parsers; no I/O in fuzz body
- [ ] Async tests use `#[tokio::test]` with timeouts for I/O
- [ ] No `unwrap()` in tests without descriptive `expect()` — or use assert macros
- [ ] Code coverage measured; threshold enforced in CI
