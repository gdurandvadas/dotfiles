---
name: standards-go-concurrency
description: MUST load when writing goroutines, channels, or sync primitives in Go; SHOULD load for concurrency code reviews. Provides safe concurrency patterns, leak prevention, and race-detection checklists.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: go-concurrency
  priority: high
---

# Go Concurrency Standards

**Provides:** Safe goroutine lifecycle management, context-first cancellation, channel ownership rules, mutex discipline, leak prevention patterns, and race-detection checklists.

**Primary references:**

- [Effective Go](https://go.dev/doc/effective_go)
- [Go CodeReviewComments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
- [Google Go Style Guide](https://google.github.io/styleguide/go/guide) / [Decisions](https://google.github.io/styleguide/go/decisions) / [Best Practices](https://google.github.io/styleguide/go/best-practices)

## Quick Reference

**Golden Rule**: Own your goroutines — every goroutine you start must have a clear owner, a stop mechanism, and a join point.

**✅ DO:**
- Pass `ctx` as the first parameter to every blocking function
- Use `errgroup.WithContext` for fan-out parallelism
- Close channels only from the sender; use directional channel types
- `defer ticker.Stop()` immediately after `time.NewTicker`
- Use `sync.WaitGroup` or `errgroup` to join all spawned goroutines
- Keep mutex critical sections minimal — no I/O under a lock
- Prefer `time.NewTimer` over `time.After` inside loops
- Prefer synchronous APIs — let the caller add the goroutine
- Use named `mu sync.Mutex` field, never embed a mutex in a struct
- Document thread-safety when read-vs-write behaviour is non-obvious

**❌ DON'T:**
- Fire-and-forget goroutines in request handlers or libraries
- Close a channel from a receiver or from multiple goroutines
- Store a `context.Context` in a struct field
- Derive a new goroutine's context from `context.Background()` instead of the parent
- Use `sync.RWMutex` without benchmark evidence of read-heavy contention
- Use `time.After` in loops (allocates a new timer each iteration)
- Copy a struct that embeds `sync.Mutex` or `sync.RWMutex`
- Spawn goroutines in `init()` — use a lifecycle-managed object instead
- Use channel buffers > 1 without documented justification

**Key Commands:**
```bash
go test -race ./...                      # detect data races
go test -run TestX -count=100 ./pkg      # stress-test concurrency
go test -timeout 30s ./...               # catch goroutine leaks via timeout
# Goroutine profile snapshot:
go tool pprof -http=:0 http://localhost:6060/debug/pprof/goroutine
go test -count=1 -run TestWorkerPool -v ./...  # verify pool goroutine count
```

---

## Context-First Cancellation

Propagate deadlines and cancellation signals through the call graph so any blocking operation can be interrupted cleanly.

- Accept `ctx context.Context` as the first parameter of every function that may block.
- In loops, add a `select` arm on `ctx.Done()` alongside the work arm.
- Derive child contexts with `context.WithTimeout` / `context.WithCancel` from the caller's ctx, never from `context.Background()`.
- Do not store ctx in struct fields; pass it through the call chain instead.

```go
// ✅ Correct: context threaded through loop
func process(ctx context.Context, jobs <-chan Job) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case j, ok := <-jobs:
            if !ok {
                return nil
            }
            if err := handle(ctx, j); err != nil {
                return err
            }
        }
    }
}

// ❌ Wrong: ctx ignored — goroutine cannot be cancelled
func process(ctx context.Context, jobs <-chan Job) error {
    for j := range jobs {
        handle(ctx, j) // ctx passed but select on Done() missing
    }
    return nil
}
```

Forgetting `select ctx.Done()` in tight inner loops; shadowing `ctx` with a new variable inside the loop body; deriving from `context.Background()` instead of the parent.

Unit tests that cancel ctx mid-flight and assert the function returns promptly; `go test -race ./...`.

---

## Goroutine Ownership & Lifecycle

Every goroutine must have a single owner responsible for starting, stopping, and joining it.

- Assign ownership at the call site that calls `go func(...)`.
- Provide a stop mechanism: a cancellable `ctx` or a dedicated done/quit channel.
- Join with `sync.WaitGroup` or `errgroup` before the owner returns or exits.
- Stop `time.Ticker` with `defer ticker.Stop()` in the owning goroutine.

```go
// ✅ Correct: owned, stoppable, joined
func startWorker(ctx context.Context, wg *sync.WaitGroup, in <-chan Item) {
    wg.Add(1)
    go func() {
        defer wg.Done()
        for {
            select {
            case <-ctx.Done():
                return
            case item, ok := <-in:
                if !ok {
                    return
                }
                process(item)
            }
        }
    }()
}
```

- **No goroutines in `init()`:** `init()` must not spawn goroutines — callers have no way to stop or wait for them. Instead, expose a lifecycle-managed object with an explicit `Start`/`Shutdown` method:

```go
// ❌ Wrong: uncontrollable goroutine started at package init
func init() {
    go doWork()
}

// ✅ Correct: explicit lifecycle object
type Worker struct {
    stop chan struct{}
    done chan struct{}
}

func NewWorker() *Worker {
    w := &Worker{stop: make(chan struct{}), done: make(chan struct{})}
    go w.run()
    return w
}

func (w *Worker) Shutdown() {
    close(w.stop)
    <-w.done
}
```

- **Prefer synchronous over async APIs:** Write functions synchronously by default — the caller can always wrap the call in a goroutine. Async APIs force concurrency on callers, making lifetimes harder to reason about and tests harder to write.

```go
// ✅ Synchronous: caller controls concurrency
func ProcessItems(items []Item) ([]Result, error) { ... }

// Caller adds concurrency when needed:
go func() { results, err := ProcessItems(items) }()
```

Fire-and-forget goroutines inside HTTP handlers that outlive the request; closing channels from multiple goroutines causing panics; leaking `time.Ticker` by only calling `Stop` without draining.

pprof goroutine profile stays bounded under load; tests include cancellation and timeout paths (see `standards-testing`).

---

## errgroup for Fan-Out / Fan-In

Use `golang.org/x/sync/errgroup` when launching parallel work where the first error should cancel everything else.

- Create with `errgroup.WithContext(parentCtx)` so the derived ctx is cancelled on the first error.
- Pass the group's ctx into every worker so they can exit early.
- Collect results into pre-allocated slices (index by worker ID) to avoid data races on shared accumulators.
- Bound parallelism with `g.SetLimit(n)` (Go 1.x/x/sync v0.1+) to cap the number of concurrent goroutines in the group — prevents unbounded goroutine creation when iterating over large inputs.

```go
// ✅ Correct: workers respect cancellation; no shared mutable state
g, ctx := errgroup.WithContext(parentCtx)
results := make([]Result, len(inputs))

for i, inp := range inputs {
    i, inp := i, inp // capture loop vars
    g.Go(func() error {
        r, err := fetch(ctx, inp)
        if err != nil {
            return err
        }
        results[i] = r
        return nil
    })
}
if err := g.Wait(); err != nil {
    return nil, err
}
```

```go
// ✅ Bounded fan-out: at most 10 goroutines at once
g, ctx := errgroup.WithContext(parentCtx)
g.SetLimit(10)

for _, inp := range inputs {
    inp := inp
    g.Go(func() error {
        return process(ctx, inp)
    })
}
if err := g.Wait(); err != nil { ... }
```

Workers that ignore the group's ctx and never check `ctx.Done()`; appending to a shared slice without synchronization (data race).

`go test -race ./...`; deterministic tests using fakes or in-process stubs (see `standards-testing`).

---

## Fan-Out / Fan-In

Distribute one input stream across N workers (fan-out) and merge their output streams back into one (fan-in) for parallel throughput without errgroup.

- Fan-out: start N worker goroutines, each reading from the **same** input channel (Go's scheduler distributes sends fairly).
- Fan-in: each worker writes to its own output channel; a merge goroutine reads all outputs and forwards to a single result channel.
- The merge goroutine uses a `sync.WaitGroup` to close the output channel only after all workers are done.
- Thread `ctx` through every goroutine so cancellation propagates.

- Closing the shared input channel before all fan-out workers have finished causes `range` to drain; ensure the producer closes only when all items are submitted.
- Not closing merged output — downstream consumers block forever.
- Using a shared result slice instead of a channel introduces data races.

`go test -race ./...`; final result count equals input count; `runtime.NumGoroutine()` returns to baseline after pipeline drains.

```go
// merge drains all cs channels into one; closes out when all are done.
func merge(ctx context.Context, cs ...<-chan Result) <-chan Result {
    var wg sync.WaitGroup
    out := make(chan Result)

    forward := func(c <-chan Result) {
        defer wg.Done()
        for r := range c {
            select {
            case out <- r:
            case <-ctx.Done():
                return
            }
        }
    }

    wg.Add(len(cs))
    for _, c := range cs {
        go forward(c)
    }

    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}

// fanOut spawns n workers, each reading from in.
func fanOut(ctx context.Context, in <-chan Job, n int) []<-chan Result {
    outs := make([]<-chan Result, n)
    for i := range n { // Go 1.22+ (older Go: for i := 0; i < n; i++)
        outs[i] = worker(ctx, in)
    }
    return outs
}

// Usage
results := merge(ctx, fanOut(ctx, jobs, runtime.NumCPU())...)
for r := range results { handle(r) }
```

---

## Channel Ownership Rules

Channels are owned by the sender — only the sender may close a channel.

- The goroutine that creates and writes to a channel is its owner and is the only one that closes it.
- Use directional types at function boundaries: `chan<- T` for producers, `<-chan T` for consumers.
- A nil channel blocks forever on send and receive — use this intentionally to disable a `select` arm.
- **Buffer sizing rule of thumb:** default to unbuffered (`0`) or size `1`. Any other size must be justified by answering: how is the size determined? what prevents it filling under load? what happens when writers block? Arbitrary sizes hide backpressure and inflate memory.

```go
// ✅ Correct: producer owns and closes; consumer reads with range
func produce(ctx context.Context) <-chan int {
    ch := make(chan int)
    go func() {
        defer close(ch) // owner closes
        for i := 0; ; i++ {
            select {
            case <-ctx.Done():
                return
            case ch <- i:
            }
        }
    }()
    return ch
}

// ❌ Wrong: receiver closes — panics if sender writes after close
func consume(ch chan int) {
    close(ch) // never do this
}
```

Multiple goroutines closing the same channel (panic); buffered channels that grow unboundedly under load.

Tests exercise the closed-channel path; `select` loops always have a ctx cancellation arm to prevent deadlock.

---

## Mutex Discipline

Use mutexes only when shared mutable state cannot be confined to a single goroutine.

- Keep critical sections as small as possible — compute outside the lock, hold only for the read/write.
- Never perform I/O (network, disk, logging) while holding a lock.
- Document lock ordering when multiple mutexes are acquired together.
- Prefer `sync.Mutex` by default; only upgrade to `sync.RWMutex` after benchmark evidence of a read-heavy bottleneck.
- **Do not embed mutexes in structs** — embedding promotes `Lock`/`Unlock` to the public API. Use a named field `mu sync.Mutex` so the mutex stays an implementation detail:

```go
// ❌ Wrong: embedding makes Lock/Unlock part of the exported API
type SMap struct {
    sync.Mutex
    data map[string]string
}

// ✅ Correct: named field hides the mutex from callers
type SMap struct {
    mu   sync.Mutex
    data map[string]string
}

func (m *SMap) Get(k string) string {
    m.mu.Lock()
    defer m.mu.Unlock()
    return m.data[k]
}
```

  - Never copy a struct that embeds `sync.Mutex` — pass by pointer.

```go
// ✅ Correct: minimal critical section, no I/O under lock
func (c *Cache) Set(key string, val []byte) {
    c.mu.Lock()
    c.data[key] = val
    c.mu.Unlock()
    // logging happens outside the lock
    c.log.Info("cache set", "key", key)
}

// ❌ Wrong: I/O inside lock blocks all concurrent readers/writers
func (c *Cache) Set(key string, val []byte) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[key] = val
    c.log.Info("cache set", "key", key) // network call under lock
}
```

Lock inversion (acquiring locks in different orders across goroutines causes deadlock); copying mutex-embedding structs by value; using `RWMutex.RLock` for write operations.

`go test -race ./...`; contention benchmarks (`go test -bench . -benchmem`); mutex profile (`/debug/pprof/mutex`) when a hot path is suspected (see `standards-observability`).

---

## sync.Once — One-Time Initialization

Use `sync.Once` to perform an action exactly once across all goroutines, regardless of how many call it concurrently.

- Embed `sync.Once` in the owning struct; call `once.Do(fn)` where `fn` contains the initialization.
- In Go 1.21+, prefer `sync.OnceFunc(fn)` (returns a no-arg func you call repeatedly) or `sync.OnceValue(fn)` (returns a func that returns the value) — they are cleaner and cache the result automatically.
- `Do` panics if `fn` panics; the panic propagates to all callers and the initialization is not retried.

- Calling `once.Do` with a different function on subsequent calls has no effect — only the first call's function runs.
- Holding a lock while calling `once.Do` a second time in the same goroutine deadlocks.
- Storing computed results requires an explicit field; use `sync.OnceValue` to avoid the boilerplate.

Concurrent goroutines all receive the same initialized value; `go test -race ./...` passes.

```go
// ✅ Classic sync.Once
type DB struct {
    once sync.Once
    conn *sql.DB
}

func (d *DB) Conn() *sql.DB {
    d.once.Do(func() {
        d.conn, _ = sql.Open("pgx", os.Getenv("DSN"))
    })
    return d.conn
}

// ✅ Go 1.21+ — sync.OnceValue (cleaner, result cached)
var getConfig = sync.OnceValue(func() *Config {
    return loadConfigFromDisk()
})

// Callers just: cfg := getConfig()
```

---

## Avoiding Common Leaks

Leaked goroutines, timers, and unclosed resources accumulate silently and exhaust memory or file descriptors.

- `time.Ticker`: `ticker := time.NewTicker(d); defer ticker.Stop()` immediately in the same function.
- `time.After` in loops: replace with `time.NewTimer` + `defer timer.Stop()` or reset the timer; `time.After` allocates a new `Timer` every iteration.
- HTTP response bodies: `defer resp.Body.Close()` after checking the error from `http.Do`.
- `select` loops must always include a `ctx.Done()` or done-channel arm — a goroutine blocked on a send to a channel no one reads is a leak.

```go
// ❌ Wrong: new timer per iteration, old timers leak until they fire
for {
    select {
    case <-time.After(1 * time.Second): // leaks
        poll()
    }
}

// ✅ Correct: single timer, reused
timer := time.NewTimer(1 * time.Second)
defer timer.Stop()
for {
    select {
    case <-ctx.Done():
        return ctx.Err()
    case <-timer.C:
        poll()
        timer.Reset(1 * time.Second)
    }
}
```

Forgetting `defer resp.Body.Close()` when an error is returned before the defer; goroutines parked on a send to a full unbuffered channel when the receiver has exited.

Assert goroutine count is bounded in tests (capture `runtime.NumGoroutine()` before/after); use `go.uber.org/goleak` in tests to detect leaked goroutines automatically; take `runtime/pprof` goroutine snapshots under load (see `standards-observability`).

```go
// ✅ goleak: add to TestMain or individual tests
func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m)
}

// Or per-test:
func TestWorker(t *testing.T) {
    defer goleak.VerifyNone(t)
    // ... test that spawns goroutines ...
}
```

---

## Worker Pool

Bounded concurrent processing — N goroutines are kept alive and reused rather than spawning one goroutine per task.

- Create a buffered task channel; start N goroutines that range over it.
- Use `sync.WaitGroup` to join workers; add N before starting, each worker calls `wg.Done()` when its loop exits.
- Expose a `Shutdown()` method (or close the task channel) only after all submitters are done.
- Keep pool size configurable; default to `runtime.NumCPU()`.

- Closing the task channel before all submitters have finished (panic: send on closed channel).
- Using an unbounded task queue (buffered channel too large) — hides backpressure and inflates memory.
- Not draining inflight tasks on shutdown when partial results are acceptable.

Pool goroutine count stays fixed under load (compare `runtime.NumGoroutine()` before/after); `go test -race ./...` passes; task completion order tested with a count.

```go
type WorkerPool struct {
    tasks chan func()
    wg    sync.WaitGroup
}

func NewWorkerPool(workers int) *WorkerPool {
    if workers <= 0 {
        workers = runtime.NumCPU()
    }
    wp := &WorkerPool{
        tasks: make(chan func(), workers*2),
    }
    wp.wg.Add(workers)
    for range workers { // Go 1.22+ (older Go: for i := 0; i < workers; i++)
        go func() {
            defer wp.wg.Done()
            for task := range wp.tasks {
                task()
            }
        }()
    }
    return wp
}

func (wp *WorkerPool) Submit(task func()) {
    wp.tasks <- task
}

func (wp *WorkerPool) Shutdown() {
    close(wp.tasks)
    wp.wg.Wait()
}
```

---

## Semaphore

Limit concurrent access to a resource without a full worker pool.

- `sem := make(chan struct{}, n)` — capacity sets the limit.
- Acquire: `sem <- struct{}{}` (blocks when full).
- Release: `<-sem` in a deferred function.
- Combine with ctx cancellation using `select` for acquire to avoid hangs.

- Acquiring without releasing on error paths (always use `defer <-sem` after a successful acquire).
- Not handling ctx cancellation during acquire — goroutine parks indefinitely if the semaphore is always full.

`go test -race ./...`; assert concurrent goroutine gauge stays ≤ n during a parallel test.

```go
func acquire(ctx context.Context, sem chan struct{}) error {
    select {
    case sem <- struct{}{}:
        return nil
    case <-ctx.Done():
        return ctx.Err()
    }
}

func doWithSemaphore(ctx context.Context, sem chan struct{}) error {
    if err := acquire(ctx, sem); err != nil {
        return err
    }
    defer func() { <-sem }()
    // critical section
    return nil
}
```

---

## Rate Limiting

Throttle external API calls, control ingress/egress rates, or protect a shared resource from overload.

- Use `golang.org/x/time/rate.NewLimiter(rate.Limit(rps), burst)`.
- Call `limiter.Wait(ctx)` before each request — it blocks until a token is available or ctx is cancelled.
- Scope limiters per-client or per-key (use a `sync.Map` or a keyed map under a mutex) rather than a single global limiter.

- Ignoring the error from `limiter.Wait(ctx)` — it returns `ctx.Err()` on cancellation.
- One global limiter shared across all clients/tenants — unfair under mixed load.
- Not accounting for bursts: a burst of 1 serializes all requests even at low average rates.

`go test -race ./...`; a load test measuring requests per second confirms the limiter clamps throughput at the configured rate.

Import path: `golang.org/x/time/rate`. Construct a limiter with `rate.NewLimiter(rate.Limit(rps), burst)` and call `if err := limiter.Wait(ctx); err != nil { return err }` before every guarded operation.

---

## Pipeline

Stream processing with multiple distinct transformation stages — each stage receives from an upstream channel and writes to a downstream channel.

- Each stage is a function that accepts `ctx context.Context` and `<-chan T` and returns `<-chan U`.
- The stage starts a goroutine, `defer close(out)` inside it, and selects on both `in` and `ctx.Done()`.
- Connect stages by passing the output channel of one as the input of the next.
- Propagate cancellation by threading ctx through every stage.

- One slow stage backs up the entire pipeline if channels are unbuffered and no ctx cancellation drains the pipe.
- Forgetting to close stage output channels — downstream stages block forever waiting for more data.
- Not propagating ctx — a cancelled pipeline leaves goroutines parked on sends.

After ctx cancel, all stage goroutines exit (assert `runtime.NumGoroutine()` returns to baseline); pipeline drains completely with a finite input; `go test -race ./...`.

```go
// generator produces integers [0, n) onto a channel.
func generator(ctx context.Context, n int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for i := range n { // Go 1.22+ (older Go: for i := 0; i < n; i++)
            select {
            case out <- i:
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}

// transform squares each value from in.
func transform(ctx context.Context, in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for v := range in {
            select {
            case out <- v * v:
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}

// Usage: connect stages.
// results := transform(ctx, generator(ctx, 10))
```

---

## Documenting Thread-Safety

Go callers assume read-only operations are concurrency-safe and mutating operations are not. Document concurrency behaviour when this assumption doesn't hold:

- **Read-mutating mismatch** — e.g., a `Lookup` that silently mutates LRU state is not safe for concurrent calls; say so.
- **API provides synchronization** — e.g., a thread-safe client or cache; document that concurrent use is safe.
- **Interface implementations** — if an interface requires concurrent use, state it in the type or interface doc comment.

```go
// Cache is safe for concurrent use by multiple goroutines.
type Cache struct { ... }

// Lookup returns the value for key, updating recency order.
// It is NOT safe to call concurrently with Set.
func (c *Cache) Lookup(key string) (string, bool) { ... }
```

---

## Skill Loading Triggers

| Situation | Also load |
|---|---|
| Reviewing concurrency code | `role-code-review` |
| Tracing goroutine latency | `standards-observability` |
| Writing concurrency tests | `standards-go-testing` |

## Verification Checklist

> For baseline formatting, vet, and go test checks see `standards-go`.

- [ ] ctx passed as first parameter to all blocking functions; never stored in struct fields
- [ ] Every goroutine has an explicit owner, stop mechanism, and is joined (WaitGroup or errgroup)
- [ ] No goroutines spawned in `init()` — lifecycle-managed object used instead
- [ ] Only senders close channels; directional channel types used at function boundaries
- [ ] No I/O held under mutex lock; mutex is a named field (`mu sync.Mutex`), not embedded
- [ ] time.Ticker always deferred Stop(); time.After not used inside loops
- [ ] HTTP response bodies always closed after error check
- [ ] go test -race passes with no warnings
- [ ] go.uber.org/goleak used in test suite to catch goroutine leaks
- [ ] Channel buffers are 0 or 1; any other size has documented justification
- [ ] errgroup workers check and respect the group's ctx; SetLimit used when input is unbounded
- [ ] sync.Once (or OnceValue/OnceFunc in 1.21+) used for one-time initialization

Note: file list is sampled.
