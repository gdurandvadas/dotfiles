---
name: standards-rust-async
description: MUST load when writing async Rust code with tokio; SHOULD load for concurrency reviews. Provides async/await patterns, task lifecycle, channel selection, shared state, and graceful shutdown.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: rust-async
  priority: high
---

# Rust Async Standards

**Provides:** Async/await patterns with tokio, task lifecycle management, channel selection (mpsc, oneshot, broadcast, watch), shared state with `Arc<Mutex<T>>`, stream processing, cancellation, and graceful shutdown.

**Primary references:**

- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [Async Book](https://rust-lang.github.io/async-book/)
- [Tokio API Docs](https://docs.rs/tokio/latest/tokio/)
- [The Rust Programming Language](https://doc.rust-lang.org/book/)

## Quick Reference

**Golden Rule**: Never block the async runtime — every blocking call must go through `spawn_blocking`.

**Do:**

- Use `tokio::spawn` for concurrent tasks; join handles to observe panics
- Use `tokio::select!` for cancellation and timeout patterns
- Use `tokio::sync` primitives (`Mutex`, `RwLock`, channels) in async code, not `std::sync`
- Use `spawn_blocking` for file I/O, CPU-heavy work, or any `std::sync` lock
- Implement graceful shutdown with a `watch` or `broadcast` channel
- Use `tokio::time::timeout` for all external I/O
- Prefer `try_join!` over manual error collection for concurrent fallible tasks
- Use `tokio::test` macro for async test functions
- Bound channel capacities — justify any buffer size > 1

**Don't:**

- Call `.await` while holding a `std::sync::Mutex` lock — use `tokio::sync::Mutex` or restructure
- Hold any lock across an `.await` point — the task may be suspended and block other tasks
- Use `unwrap()` on `JoinHandle` results without handling `JoinError` (task panics)
- Fire-and-forget `tokio::spawn` without storing the `JoinHandle` — lost panics and leaks
- Use `tokio::sync::Mutex` for non-async critical sections — `std::sync::Mutex` is faster when no `.await` is needed inside the lock
- Block inside `async fn` — no `std::thread::sleep`, no synchronous file I/O
- Derive from `tokio::runtime::Handle` in library code — accept a runtime reference or be runtime-agnostic
- Use `async-trait` when native async traits (Rust 1.75+) suffice

**Key commands:**

```sh
cargo test                                 # run all tests (sync + async)
cargo test -- --nocapture                  # see println! output in async tests
RUST_LOG=debug cargo run                   # with tracing/env_logger
tokio-console                              # runtime introspection (requires tokio unstable)
```

---

## Async/Await Fundamentals

Rust futures are lazy — they do nothing until polled. `.await` drives a future to completion. `async fn` returns `impl Future<Output = T>`.

```rust
async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    let body = reqwest::get(url).await?.text().await?;
    Ok(body)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let data = fetch_data("https://example.com").await?;
    println!("{data}");
    Ok(())
}
```

For library code, prefer returning `impl Future` instead of depending on a specific runtime. Use `#[tokio::main]` only in binary entry points.

---

## Concurrent Execution

### join! and try_join!

Use `tokio::join!` to run futures concurrently on the same task. Use `tokio::try_join!` when any failure should cancel the rest.

```rust
// Concurrent — both run simultaneously
let (users, orders) = tokio::join!(
    fetch_users(ctx),
    fetch_orders(ctx),
);

// Concurrent with early cancellation on first error
let (users, orders) = tokio::try_join!(
    fetch_users(ctx),
    fetch_orders(ctx),
)?;
```

### tokio::spawn

Spawn a new task for independent work. Always store the `JoinHandle` and handle `JoinError`.

```rust
let handle = tokio::spawn(async move {
    expensive_computation().await
});

match handle.await {
    Ok(result) => println!("result: {result}"),
    Err(e) if e.is_panic() => eprintln!("task panicked"),
    Err(e) => eprintln!("task failed: {e}"),
}
```

**Pitfalls:**
- Dropping a `JoinHandle` does not cancel the task — it detaches. Use `handle.abort()` for cancellation.
- `tokio::spawn` requires `'static` — the future cannot borrow from the caller's stack. Move owned data in or use `Arc`.

---

## select! for Cancellation and Timeouts

`tokio::select!` races multiple futures; the first to complete wins, the rest are dropped (cancelled).

```rust
use tokio::time::{sleep, Duration};

async fn with_timeout<T>(future: impl Future<Output = T>, secs: u64) -> Result<T, &'static str> {
    tokio::select! {
        result = future => Ok(result),
        _ = sleep(Duration::from_secs(secs)) => Err("timeout"),
    }
}
```

For cancellable long-running loops:

```rust
async fn worker(mut shutdown: tokio::sync::watch::Receiver<bool>) {
    loop {
        tokio::select! {
            _ = do_work() => {}
            _ = shutdown.changed() => {
                break;
            }
        }
    }
}
```

**Pitfalls:**
- `select!` drops non-winning futures. If a future holds resources (e.g., a partially-written buffer), cancellation may leave work incomplete. Use cancellation-safe futures or `tokio::pin!` + loop to resume.
- Branches are polled in declaration order by default — use `biased;` only when intentional.

---

## Channel Types

| Channel | Crate | Pattern | Buffer |
|---------|-------|---------|--------|
| `mpsc` | `tokio::sync` | Many producers, one consumer | Bounded or unbounded |
| `oneshot` | `tokio::sync` | Single value, one-shot | N/A |
| `broadcast` | `tokio::sync` | Many producers, many consumers | Bounded |
| `watch` | `tokio::sync` | Single producer, many consumers (latest value) | 1 (always latest) |

### mpsc — Work Queues

```rust
let (tx, mut rx) = tokio::sync::mpsc::channel(32);

tokio::spawn(async move {
    tx.send("hello").await.unwrap();
});

while let Some(msg) = rx.recv().await {
    println!("received: {msg}");
}
```

Sender is `Clone`; receiver is not. Close the channel by dropping all senders.

### oneshot — Request/Response

```rust
let (tx, rx) = tokio::sync::oneshot::channel();

tokio::spawn(async move {
    let result = compute().await;
    let _ = tx.send(result); // receiver may have been dropped
});

match rx.await {
    Ok(value) => println!("got: {value}"),
    Err(_) => eprintln!("sender dropped"),
}
```

### watch — Configuration/State Broadcasting

```rust
let (tx, mut rx) = tokio::sync::watch::channel("initial");

tokio::spawn(async move {
    while rx.changed().await.is_ok() {
        println!("config updated: {}", *rx.borrow());
    }
});

tx.send("updated").unwrap();
```

Receivers always see the latest value. Ideal for configuration reloads and shutdown signals.

---

## Shared State

### tokio::sync::Mutex

Use when the critical section contains `.await` points:

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

let state = Arc::new(Mutex::new(Vec::new()));

let state_clone = Arc::clone(&state);
tokio::spawn(async move {
    let mut guard = state_clone.lock().await;
    guard.push(42);
});
```

### std::sync::Mutex in Async

Use `std::sync::Mutex` when the critical section is short and contains no `.await`:

```rust
use std::sync::{Arc, Mutex};

let counter = Arc::new(Mutex::new(0));

// Short critical section — std::sync::Mutex is fine and faster
{
    let mut lock = counter.lock().unwrap();
    *lock += 1;
}
// .await happens outside the lock
do_async_work().await;
```

**Rule of thumb:** If you never `.await` while the lock is held, use `std::sync::Mutex`. If you must `.await` inside the critical section, use `tokio::sync::Mutex`.

### Avoiding Locks

Prefer channels or message-passing over shared mutable state when possible. Each task owns its own state and communicates via channels — easier to reason about, no deadlock risk.

---

## Streams

Process asynchronous sequences with `tokio_stream` or `futures::stream`:

```rust
use tokio_stream::{self as stream, StreamExt};

let mut s = stream::iter(vec![1, 2, 3, 4, 5])
    .filter(|x| *x % 2 == 0)
    .map(|x| x * 2);

while let Some(value) = s.next().await {
    println!("{value}");
}
```

Use `.then()` for async transformations within a stream. Use `.buffer_unordered(n)` to process up to `n` items concurrently.

---

## Graceful Shutdown

Use a `watch` channel (or `CancellationToken` from `tokio-util`) to signal all tasks:

```rust
use tokio::signal;

#[tokio::main]
async fn main() {
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

    let worker = tokio::spawn(run_worker(shutdown_rx));

    signal::ctrl_c().await.unwrap();
    let _ = shutdown_tx.send(true);

    worker.await.unwrap();
}

async fn run_worker(mut shutdown: tokio::sync::watch::Receiver<bool>) {
    loop {
        tokio::select! {
            _ = do_periodic_work() => {}
            _ = shutdown.changed() => break,
        }
    }
}
```

**Pitfalls:**
- Dropping the `watch::Sender` closes the channel but `changed()` returns `Err`, not a clean signal. Send an explicit value before dropping.
- Tasks spawned without a shutdown handle leak — propagate the shutdown signal to all spawned tasks.

---

## Error Handling in Async

Combine `thiserror` with async-specific error variants:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
enum ServiceError {
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("timeout after {0:?}")]
    Timeout(std::time::Duration),
    #[error("task panicked")]
    TaskPanicked(#[from] tokio::task::JoinError),
}
```

Use `tokio::time::timeout` and map the `Elapsed` error:

```rust
let result = tokio::time::timeout(Duration::from_secs(5), fetch_data())
    .await
    .map_err(|_| ServiceError::Timeout(Duration::from_secs(5)))??;
```

---

## Runtime Configuration

```rust
// Explicit runtime — use in libraries or when you need control
let runtime = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(4)
    .thread_name("my-worker")
    .enable_all()
    .build()
    .unwrap();

runtime.block_on(async { /* ... */ });
```

- **Multi-thread** (`new_multi_thread`): default for servers. Work-stealing scheduler.
- **Current-thread** (`new_current_thread`): single-threaded. Useful for CLIs, tests, or embedded.
- Set `worker_threads` based on workload — default is `num_cpus`. I/O-heavy services may benefit from more.

---

## Async Traits

As of Rust 1.75+, async functions in traits are natively supported:

```rust
trait Repository {
    async fn find_by_id(&self, id: u64) -> Result<User, Error>;
    async fn save(&self, user: &User) -> Result<(), Error>;
}
```

For older Rust or when `dyn Trait` is needed, use the `async-trait` crate:

```rust
#[async_trait::async_trait]
trait Repository: Send + Sync {
    async fn find_by_id(&self, id: u64) -> Result<User, Error>;
}
```

---

## Skill Loading Triggers

| Situation | Also load |
|-----------|-----------|
| Reviewing async Rust code | `role-code-review` |
| Writing async tests | `standards-rust-testing` |
| Observability / tracing in async services | `standards-observability` |
| Auth, secrets in async handlers | `standards-security` |

## Verification Checklist

> For baseline formatting, clippy, and cargo test checks see `standards-rust`.

- [ ] No blocking calls (`std::thread::sleep`, sync file I/O) inside `async fn` — `spawn_blocking` used
- [ ] No lock held across `.await` — `std::sync::Mutex` used for sync sections, `tokio::sync::Mutex` only when `.await` is inside the critical section
- [ ] All `JoinHandle`s are awaited or explicitly aborted — no fire-and-forget spawns
- [ ] `tokio::select!` branches use cancellation-safe futures or document cancellation behavior
- [ ] Channel buffer sizes are bounded and justified
- [ ] Graceful shutdown signal propagated to all spawned tasks
- [ ] `tokio::time::timeout` used for all external I/O
- [ ] Errors from `.await?` include context (`.context("message")` or structured error types)
- [ ] `tokio::test` used for async test functions
- [ ] No `async-trait` where native async traits (Rust 1.75+) would work
