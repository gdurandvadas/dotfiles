---
name: standards-rust
description: MUST load when writing or reviewing Rust code; SHOULD load for Rust API or crate design decisions. Provides idiomatic Rust patterns, ownership and borrowing, trait design, error handling, generics, and project structure guidance.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: rust
  priority: high
---

# Rust Standards

**Provides:** Idiomatic Rust 2021 edition patterns, ownership and borrowing, lifetime annotations, trait hierarchies, generics, error handling with `Result`/`Option`, type system design, project structure, and formatting/tooling. For async/concurrency and testing see the dedicated subskills.

**Primary references:**

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Rust Reference](https://doc.rust-lang.org/reference/)
- [Clippy Lints](https://rust-lang.github.io/rust-clippy/master/)

## Quick Reference

**Golden Rule**: Leverage the type system and ownership model to make invalid states unrepresentable at compile time.

**Style principles (priority order):**

| Principle       | Key question                                   |
| --------------- | ---------------------------------------------- |
| Safety          | Is this memory-safe without `unsafe`?          |
| Clarity         | Can a reader follow ownership and lifetimes?   |
| Correctness     | Does the type system enforce the invariants?   |
| Performance     | Are zero-cost abstractions used where possible?|
| Ergonomics      | Is the API pleasant and hard to misuse?        |

**Do:**

- Run `cargo fmt` and `cargo clippy --all-targets --all-features` on every save
- Prefer borrowing (`&T`, `&mut T`) over ownership transfer when the callee doesn't need to own
- Use `&str` over `String` and `&[T]` over `Vec<T>` in function parameters
- Return `Result` for fallible operations; use `?` for propagation
- Annotate lifetimes explicitly where inference is insufficient
- Document every `unsafe` block with its safety invariants
- Design zero-value-equivalent defaults via `Default` trait
- Use `Cow<'a, T>` for conditional cloning
- Accept `impl Into<T>` / `impl AsRef<T>` for ergonomic APIs
- Derive standard traits (`Debug`, `Clone`, `PartialEq`, `Eq`, `Hash`) when applicable

**Don't:**

- Use `unwrap()` in production code — use `expect("reason")` or propagate with `?`
- Use `unsafe` without documenting safety invariants
- Clone unnecessarily — profile first, then clone only when borrowing is impossible
- Use `String` when `&str` suffices in function parameters
- Ignore clippy warnings — fix or explicitly `#[allow]` with justification
- Mix blocking and async code — use `spawn_blocking` for blocking I/O in async contexts
- Use `panic!` as flow control — reserve for truly unrecoverable bugs
- Store `dyn Trait` when generics or `impl Trait` would suffice
- Write manual `From`/`Display` when `thiserror` derives would be cleaner
- Use `Box<dyn Error>` in library crates — define structured error types

**Key commands:**

```sh
cargo fmt --check                          # style check (CI gate)
cargo clippy --all-targets --all-features  # lint all code including tests
cargo test                                 # unit + integration tests
cargo test --doc                           # doctests only
cargo bench                                # criterion benchmarks
cargo doc --open                           # generate and browse docs
cargo build --release                      # optimized build
cargo check                               # fast type-check without codegen
cargo tree                                 # dependency graph
cargo update                               # update Cargo.lock
```

---

## Formatting & Tooling

- **rustfmt**: Run `cargo fmt` on every save; CI must reject unformatted code (`cargo fmt --check` exits non-zero). Configure project settings in `rustfmt.toml`.
- **clippy**: Run `cargo clippy --all-targets --all-features` in CI; treat all warnings as errors (`-D warnings`). Configure lint levels in `clippy.toml` or `Cargo.toml` `[lints.clippy]` (Rust 1.74+).
- **rust-analyzer**: Enable format-on-save and clippy-on-save in editor integration.
- **cargo check**: Use for fast feedback during development — type-checks without generating code.

### Recommended CI Pipeline

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
cargo doc --no-deps
```

---

## Ownership & Borrowing

### Ownership Rules

1. Each value has exactly one owner.
2. When the owner goes out of scope, the value is dropped.
3. Ownership can be transferred (moved) or temporarily lent (borrowed).

### Borrowing Guidelines

- **Immutable borrows** (`&T`): unlimited concurrent readers allowed.
- **Mutable borrows** (`&mut T`): exactly one writer, no concurrent readers.
- Prefer `&T` parameters for read-only access; `&mut T` for mutation; take ownership only when the function genuinely needs it.

```rust
// Prefer borrowing over cloning
fn process(data: &[u8]) -> usize {
    data.iter().filter(|&&b| b != 0).count()
}

// Take ownership only when needed (e.g., storing in a struct)
fn store(data: String) -> Record {
    Record { data }
}
```

### Lifetime Annotations

Annotate lifetimes explicitly when the compiler cannot infer the relationship between input and output borrows.

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

struct Excerpt<'a> {
    part: &'a str,
}
```

**Elision rules** handle most cases. Add explicit annotations when:
- A function returns a reference and has multiple reference parameters
- A struct holds a reference
- The relationship between lifetimes is non-obvious

### Smart Pointers

| Type | Use case |
|------|----------|
| `Box<T>` | Heap allocation, single owner, known-size requirement |
| `Rc<T>` | Shared ownership, single-threaded |
| `Arc<T>` | Shared ownership, thread-safe |
| `Cow<'a, T>` | Borrow when possible, clone only when mutation needed |
| `RefCell<T>` | Interior mutability, single-threaded (runtime borrow check) |
| `Cell<T>` | Interior mutability for `Copy` types |

**Combining patterns:**
- `Rc<RefCell<T>>` — shared mutable state, single thread
- `Arc<Mutex<T>>` — shared mutable state, multi-threaded
- `Arc<RwLock<T>>` — shared mutable state, read-heavy multi-threaded

### Pin

`Pin<P>` guarantees the pointee will not move in memory. Required for self-referential types and `async` futures. Prefer `Box::pin(value)` to create pinned heap values.

### RAII and Drop

Implement `Drop` for RAII cleanup. Destructors run in declaration order (reverse of creation). Use `std::mem::drop(value)` to drop early when needed.

---

## Traits & Generics

### Trait Design

- Keep traits small and focused — single responsibility.
- Prefer associated types when there is one logical type per implementation; use generic parameters when multiple type combinations are needed.
- Provide default method implementations where a sensible default exists.
- Use supertraits (`trait Child: Parent`) to compose behavior.

```rust
trait Summary {
    fn summarize(&self) -> String;
    fn preview(&self) -> String {
        format!("{}...", &self.summarize()[..50.min(self.summarize().len())])
    }
}
```

### Generics and Bounds

- Use `where` clauses for complex bounds (more readable than inline bounds).
- Constrain to the minimum required: `T: Display` not `T: Display + Debug + Clone` unless all are needed.
- Use `impl Trait` in argument position for simple generic parameters; named generics when the type appears multiple times.

```rust
// impl Trait — simple single-use
fn print_item(item: &impl Display) {
    println!("{item}");
}

// Named generic — type used in multiple positions
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    list.iter().max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap()
}
```

### Static vs Dynamic Dispatch

| Approach | Syntax | When to use |
|----------|--------|-------------|
| Static (monomorphization) | `impl Trait` / `<T: Trait>` | Performance-critical, known types at compile time |
| Dynamic (vtable) | `&dyn Trait` / `Box<dyn Trait>` | Heterogeneous collections, plugin architectures |

Use dynamic dispatch when you need to store different concrete types in the same collection. Use static dispatch everywhere else.

### Object Safety

A trait is object-safe (usable as `dyn Trait`) when:
- No methods return `Self`
- No methods have generic type parameters
- All methods take `&self`, `&mut self`, or `self: Box<Self>`

### Standard Trait Implementations

Derive these whenever possible:

| Trait | Purpose | Notes |
|-------|---------|-------|
| `Debug` | Debug formatting | Derive for all types |
| `Clone` | Explicit duplication | Derive unless expensive |
| `PartialEq`, `Eq` | Equality comparison | Derive for value types |
| `Hash` | Hashing (requires `Eq`) | Derive for map keys |
| `Default` | Zero/empty value | Derive when sensible defaults exist |
| `Display` | User-facing formatting | Implement manually |
| `From`/`Into` | Type conversion | Implement `From`; `Into` is auto-derived |
| `Serialize`/`Deserialize` | serde serialization | Derive with `serde` |

### Extension Traits

Add methods to foreign types via extension traits:

```rust
trait StrExt {
    fn truncate_to(&self, max: usize) -> &str;
}

impl StrExt for str {
    fn truncate_to(&self, max: usize) -> &str {
        &self[..self.len().min(max)]
    }
}
```

### Sealed Traits

Prevent external implementations with a private supertrait:

```rust
mod sealed { pub trait Sealed {} }

pub trait MyTrait: sealed::Sealed {
    fn method(&self);
}
```

### Operator Overloading

Implement `std::ops` traits (`Add`, `Sub`, `Mul`, `Index`, etc.) for domain types. Always return `Self::Output` consistently. Implement both `Type op Type` and `&Type op &Type` when the type is `Copy` or the reference form is useful.

### From/Into and TryFrom/TryInto

- Implement `From<T>` for infallible conversions — `Into<T>` is auto-derived.
- Implement `TryFrom<T>` for fallible conversions — define a meaningful `Error` type.
- Accept `impl Into<T>` in APIs for ergonomic conversion at call sites.

---

## Error Handling

### Core Rules

- Return `Result<T, E>` for fallible operations. Never discard errors silently.
- Use `?` for propagation — it is the Rust equivalent of Go's `if err != nil { return err }`.
- Reserve `panic!` for unrecoverable bugs (violated invariants, unreachable states).
- Use `expect("context message")` over `unwrap()` in the rare cases where panic is acceptable.

### Library vs Application Errors

| Context | Crate | Pattern |
|---------|-------|---------|
| Libraries | `thiserror` | Structured enum errors with `#[derive(Error)]` and `#[from]` for automatic conversion |
| Applications | `anyhow` | `anyhow::Result<T>` with `.context("message")` for ad-hoc error chains |

### Structured Errors with thiserror

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("parse error for `{value}`: {reason}")]
    Parse { value: String, reason: String },
    #[error("not found: {0}")]
    NotFound(String),
}

fn read_config(path: &str) -> Result<String, AppError> {
    let content = std::fs::read_to_string(path)?; // auto-converts via #[from]
    Ok(content)
}
```

### Application Errors with anyhow

```rust
use anyhow::{Context, Result, bail, ensure};

fn process_file(path: &str) -> Result<()> {
    let content = std::fs::read_to_string(path)
        .context(format!("failed to read {path}"))?;
    ensure!(!content.is_empty(), "file is empty");
    if content.len() > 10_000 {
        bail!("file too large");
    }
    Ok(())
}
```

### Option Handling

- Use `Option<T>` for values that may be absent — not sentinel values.
- Chain with combinators: `.map()`, `.and_then()`, `.unwrap_or()`, `.unwrap_or_else()`.
- Convert between `Option` and `Result` with `.ok_or()` / `.ok_or_else()`.
- Use `if let Some(v) = opt` or pattern matching for control flow.

### Error Conversion via From

Implement `From<SourceError> for TargetError` to enable `?` propagation across error types. `thiserror`'s `#[from]` attribute does this automatically.

---

## Naming & Modules

- **Crate names**: `snake_case`, hyphenated in `Cargo.toml` (maps to `snake_case` in code).
- **Types**: `PascalCase` — `HttpClient`, `UserId`.
- **Functions/methods**: `snake_case` — `read_config`, `is_valid`.
- **Constants**: `SCREAMING_SNAKE_CASE` — `MAX_RETRIES`, `DEFAULT_TIMEOUT`.
- **Modules**: `snake_case`, match file name.
- **Trait naming**: adjective or `-able` suffix — `Readable`, `Encodable`, `Summary`.
- **Builder methods**: use `self` by value for chaining — `fn port(mut self, p: u16) -> Self`.
- **Getters**: name as the field — `fn name(&self) -> &str`, no `get_` prefix.
- **Fallible constructors**: `fn new(...) -> Result<Self, Error>` or `fn try_new(...)`.

### Module Organization

```
src/
├── lib.rs           # Public API re-exports
├── error.rs         # Error types for the crate
├── config.rs        # Configuration
├── models/
│   ├── mod.rs       # Re-exports
│   ├── user.rs
│   └── order.rs
└── utils.rs         # Internal helpers (pub(crate))
```

- Keep `lib.rs` thin — re-export from submodules.
- Use `pub(crate)` for internal-only items.
- Put error types in a dedicated `error.rs` or `errors.rs`.
- Avoid deep nesting — flat is better than nested when module count is small.

### Documentation

- Doc comments (`///`) on every public item.
- Start with a single-sentence summary.
- Include `# Examples` section with runnable code blocks (doctests).
- Use `# Errors` section to document when a function returns `Err`.
- Use `# Panics` section to document when a function may panic.
- Use `# Safety` section for `unsafe` functions explaining caller obligations.

---

## API & Type Design

### Newtype Pattern

Wrap primitive types to add type safety:

```rust
struct UserId(u64);
struct Email(String);
```

Prevents mixing up `u64` values that represent different things. Implement `From`/`Into` for conversion.

### Builder Pattern

Use builders when construction has 3+ optional parameters or when validation is needed:

```rust
struct ServerConfig {
    host: String,
    port: u16,
}

struct ServerConfigBuilder {
    host: Option<String>,
    port: Option<u16>,
}

impl ServerConfigBuilder {
    fn new() -> Self { Self { host: None, port: None } }
    fn host(mut self, h: impl Into<String>) -> Self { self.host = Some(h.into()); self }
    fn port(mut self, p: u16) -> Self { self.port = Some(p); self }
    fn build(self) -> Result<ServerConfig, &'static str> {
        Ok(ServerConfig {
            host: self.host.ok_or("host required")?,
            port: self.port.unwrap_or(8080),
        })
    }
}
```

### Typestate Pattern

Encode state transitions in the type system to make invalid transitions a compile error:

```rust
struct Unlocked;
struct Locked;

struct Door<State> {
    _state: std::marker::PhantomData<State>,
}

impl Door<Locked> {
    fn unlock(self) -> Door<Unlocked> { Door { _state: std::marker::PhantomData } }
}

impl Door<Unlocked> {
    fn lock(self) -> Door<Locked> { Door { _state: std::marker::PhantomData } }
    fn open(&self) { /* only unlocked doors can be opened */ }
}
```

### Enums for Domain Modeling

Prefer enums over boolean flags or stringly-typed values:

```rust
enum PaymentStatus {
    Pending,
    Completed { transaction_id: String },
    Failed { reason: String },
}
```

### Serialize/Deserialize

- Use `serde` derive macros with explicit field attributes.
- Use `#[serde(rename_all = "camelCase")]` for JSON APIs.
- Use `#[serde(deny_unknown_fields)]` for strict parsing.
- Use `#[serde(default)]` for optional fields with defaults.

---

## Project Structure

```
my-project/
├── Cargo.toml
├── Cargo.lock           # Commit for binaries; gitignore for libraries
├── src/
│   ├── lib.rs           # Library root (if library crate)
│   ├── main.rs          # Binary root (if binary crate)
│   └── bin/             # Additional binaries
├── tests/               # Integration tests
├── benches/             # Criterion benchmarks
├── examples/            # Example programs
└── .cargo/config.toml   # Local cargo config
```

- Workspace (`Cargo.toml` with `[workspace]`) for multi-crate projects.
- Keep `main.rs` thin — delegate to `lib.rs` for testability.
- Integration tests in `tests/` cannot access `pub(crate)` items — test the public API.

### Feature Flags

Use Cargo features for optional functionality:

```toml
[features]
default = ["json"]
json = ["dep:serde_json"]
full = ["json", "yaml"]
```

Gate code with `#[cfg(feature = "json")]`. Keep the default feature set minimal.

### Dependency Management

- Pin `major.minor` in `Cargo.toml`: `serde = "1.0"` not `serde = "*"`.
- Use `cargo update` to refresh `Cargo.lock`.
- Audit with `cargo audit` for known vulnerabilities.
- Minimize dependency count — each dep is an attack surface and compile-time cost.

---

## Unsafe Rust

- Minimize `unsafe` blocks — the smaller the `unsafe` scope, the easier to audit.
- Every `unsafe` block must have a `// SAFETY:` comment explaining why the invariants are upheld.
- Prefer safe abstractions: wrap `unsafe` in a safe public API.
- Common valid uses: FFI calls, raw pointer manipulation for performance-critical data structures, implementing `Send`/`Sync`.
- Run tests under Miri (`cargo +nightly miri test`) to detect undefined behavior.

```rust
// SAFETY: `ptr` is valid, aligned, and the data it points to is initialized
// because it was just allocated by Vec and len <= capacity.
unsafe { std::ptr::read(ptr) }
```

---

## Skill Loading Triggers

| Situation | Also load |
|-----------|-----------|
| Writing any Rust code | `standards-code` |
| Writing Rust tests, benchmarks, doctests | `standards-rust-testing`, `standards-testing` |
| async/await, tokio, channels, shared state | `standards-rust-async` |
| Auth, secrets, user input, crypto | `standards-security` |
| Implementing features/fixes | `role-developer` |
| API/crate/service design | `role-architect` |
| Rust PR review | `role-code-review` |

## Verification Checklist

- [ ] `cargo fmt --check` produces no output
- [ ] `cargo clippy --all-targets --all-features -- -D warnings` passes
- [ ] All public items have doc comments with `# Examples`
- [ ] `cargo test` passes (unit + integration + doctests)
- [ ] No `unwrap()` in non-test code — `expect("reason")` or `?` used
- [ ] Errors use structured types (`thiserror` for libs, `anyhow` for apps) — no `Box<dyn Error>` in library crates
- [ ] Every `unsafe` block has a `// SAFETY:` comment
- [ ] Lifetimes are annotated where elision is insufficient
- [ ] `Clone` is not used where borrowing would suffice (profile-justified exceptions documented)
- [ ] Function parameters use borrowed types (`&str`, `&[T]`, `&Path`) over owned (`String`, `Vec<T>`, `PathBuf`)
- [ ] Newtypes used for domain identifiers instead of bare primitives
- [ ] Standard traits derived (`Debug`, `Clone`, `PartialEq`, `Eq`, `Hash`) where applicable
- [ ] `cargo doc --no-deps` builds without warnings
- [ ] `cargo audit` reports no known vulnerabilities
- [ ] Feature flags are minimal; default set does not pull unnecessary deps
