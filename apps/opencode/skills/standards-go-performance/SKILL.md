---
name: standards-go-performance
description: MUST load when diagnosing Go performance issues or tuning GC; SHOULD load for performance reviews or allocation-sensitive code. Provides pprof/trace workflows, allocation control, GC tuning guardrails, and runtime metrics patterns.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: go-performance
  priority: high
---

# Go Performance Standards

**Provides:** pprof/trace profiling workflows, allocation control patterns, escape analysis guidance, GC tuning guardrails, and runtime metrics for production observability.

**Primary references:**

- [Effective Go](https://go.dev/doc/effective_go)
- [Go CodeReviewComments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
- [Google Go Style Guide](https://google.github.io/styleguide/go/guide) / [Decisions](https://google.github.io/styleguide/go/decisions) / [Best Practices](https://google.github.io/styleguide/go/best-practices)
- [Go Diagnostics Guide](https://go.dev/doc/diagnostics)
- [Go GC Guide](https://go.dev/doc/gc-guide)

## Quick Reference

**Golden Rule**: Profile first. Never optimize without data.

**Do** (✅):
- Collect a focused profile before changing anything
- Preallocate slices with known capacity: `make([]T, 0, n)`
- Use `strings.Builder` / `bytes.Builder` in hot paths
- Reuse buffers with `sync.Pool` when benchmarks justify it
- Use `strconv` (not `fmt`) for int/float↔string in hot loops
- Hoist `[]byte("constant")` outside loops; preallocate maps with `make(map[K]V, n)`
- Set `GOMEMLIMIT` in containers with ≥10% headroom
- Export `runtime/metrics` and alert on GC CPU fraction and goroutine count
- Document before/after benchmark numbers for every change

**Don't** (❌):
- Optimize without a pprof or `benchmem` profile showing the bottleneck
- Collect CPU and heap profiles simultaneously (they interfere)
- Use `fmt.Sprintf` or `+` concatenation in hot loops
- Box values into `any` / `interface{}` in allocation-sensitive code
- Set `GOMEMLIMIT` too tight (causes GC thrashing)
- Disable GC (`GOGC=off`) in shared or multi-tenant environments
- Use `unsafe` tricks to force stack allocation

**Key Commands:**

```bash
go test -cpuprofile cpu.out -memprofile mem.out ./pkg
go tool pprof -http=:0 ./pkg.test cpu.out        # flame graph UI
go test -bench . -benchmem ./...                 # allocs/op
go test -trace trace.out ./pkg && go tool trace trace.out
go build -gcflags=all='-m' ./...                 # escape analysis
GODEBUG=gctrace=1 ./myservice                    # live GC output
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30  # live CPU profile
go build -pgo=default.pgo ./cmd/myservice                           # PGO build
```

---

## Pattern 1: Measure First — pprof Workflow

Use pprof to locate real bottlenecks before touching any code.

**When:** CPU hot paths, latency regressions, or unexplained memory growth.

**How:**
- Collect one targeted profile at a time — CPU *or* heap, not both simultaneously
- Benchmark: `go test -cpuprofile cpu.out -bench BenchmarkFoo ./pkg`
- Analyze interactively: `go tool pprof -http=:0 ./pkg.test cpu.out`
- Focus on `top` (cumulative/flat), `list FunctionName`, and the flame graph
- Change exactly one thing; re-collect the profile; compare
- Record baseline and post-change numbers in the PR or commit message

**Pitfalls:**
- Optimizing based on code reading alone — the bottleneck is rarely where you expect
- Collecting multiple profiles in a single run (timing interference skews results)
- Treating micro-benchmark results as production truth (cache, data size, and concurrency differ)

**Verify:** Documented before/after numbers exist; flame graph or `top` confirms the hot path moved.

---

## Pattern 1b: Profiling Long-Running Services

For servers and daemons, enable pprof via HTTP rather than start/stop in `main`.

**When:** Production services, long-lived daemons, or any process where you cannot easily add start/stop calls around the interesting work.

**How:**
- Import `_ "net/http/pprof"` in your `main` package (side-effect import registers handlers on `http.DefaultServeMux`).
- Serve on a separate, internal-only port:

```go
import (
    _ "net/http/pprof"
    "net/http"
)

// In main or server init — bind to loopback or internal network only
go http.ListenAndServe("localhost:6060", nil)
```

- Collect profiles on demand:

```bash
# 30-second CPU profile from a running service
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Heap snapshot
go tool pprof http://localhost:6060/debug/pprof/heap

# Goroutine dump
go tool pprof http://localhost:6060/debug/pprof/goroutine
```

- For programmatic collection (e.g., triggered by a signal or health check):

```go
import (
    "os"
    "runtime/pprof"
)

func writeCPUProfile(path string, fn func()) error {
    f, err := os.Create(path)
    if err != nil { return err }
    defer f.Close()
    if err := pprof.StartCPUProfile(f); err != nil { return err }
    fn()
    pprof.StopCPUProfile()
    return nil
}

func writeHeapProfile(path string) error {
    f, err := os.Create(path)
    if err != nil { return err }
    defer f.Close()
    runtime.GC() // get up-to-date statistics
    return pprof.WriteHeapProfile(f)
}
```

**Pitfalls:**
- Exposing `/debug/pprof` on a public-facing port is a security risk — bind to loopback or a firewall-protected internal address only.
- CPU and heap profiling simultaneously skews both — collect one at a time.
- `runtime.GC()` before a heap snapshot forces a collection; do not call it in production hot paths.

**Verify:** `curl -s http://localhost:6060/debug/pprof/` returns the index page; profiles download and open with `go tool pprof`.

---

## Pattern 2: Allocation Control

Reduce `allocs/op` to lower GC pressure and improve throughput.

**When:** `go test -bench . -benchmem` shows high `allocs/op`, or GC CPU fraction is elevated in production.

**How:**
- Preallocate slices: `make([]T, 0, n)` when approximate size is known
- Build strings in hot paths with `strings.Builder`; build byte slices with `bytes.Builder`
- Pool short-lived, large buffers:

```go
var bufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

func process(data []byte) {
    buf := bufPool.Get().(*bytes.Buffer)
    buf.Reset()
    defer bufPool.Put(buf)
    // use buf ...
}
```

- Avoid boxing small values into `any` / `interface{}` on hot paths

### Hot-Path Allocation Tricks

These micro-optimizations are worth applying only where benchmarks or heap profiles confirm allocation is a bottleneck — not speculatively.

**Prefer `strconv` over `fmt` for primitive↔string conversions:**
`fmt.Sprint`/`Sprintf` use reflection and allocate more than their `strconv` equivalents:
```go
// ❌ ~143 ns/op, 2 allocs/op
s := fmt.Sprint(rand.Int())

// ✅ ~64 ns/op, 1 alloc/op
s := strconv.Itoa(rand.Int())
```
Other useful alternatives: `strconv.FormatInt`, `strconv.AppendInt` (appends to an existing `[]byte`, zero allocs).

**Convert constant strings to `[]byte` once, outside the loop:**
`[]byte("constant")` allocates on every call. Hoist it:
```go
// ❌ New allocation each iteration
for range items {
    w.Write([]byte("separator"))
}

// ✅ Single allocation, ~7x faster in benchmarks
sep := []byte("separator")
for range items {
    w.Write(sep)
}
```

**Preallocate maps with a size hint when approximate count is known:**
```go
// ✅ Fewer bucket resizes during population
m := make(map[string]Entry, len(files))
```
Note: map capacity is a *hint* — the runtime approximates bucket count but does not guarantee zero resizes, unlike slices where capacity is an exact allocation.

**Preallocate slices when using append in loops:**
Slice capacity is an exact allocation; `append` incurs zero reallocations until capacity is reached:
```go
// ❌ Repeated doubling reallocations
out := make([]Result, 0)
for _, v := range input { out = append(out, process(v)) }

// ✅ Single allocation
out := make([]Result, 0, len(input))
for _, v := range input { out = append(out, process(v)) }
```

**Pass values, not pointers, for small fixed-size types:**
`string`, `io.Reader`, and `time.Time` are already small fixed-size headers. Passing `*string` or `*io.Reader` adds indirection with no benefit and may cause the pointee to escape to the heap:
```go
// ❌ Unnecessary pointer — pointee may escape, callers must deref
func process(s *string) { fmt.Println(*s) }

// ✅ Value copy is cheap; no heap escape for the caller's local
func process(s string) { fmt.Println(s) }
```
Exceptions: large structs where copying is genuinely expensive (confirm with benchmarks), or when the function must mutate the caller's variable.

**Pitfalls:**
- Adding `sync.Pool` before profiling shows allocation as the bottleneck — pool overhead is non-zero
- Sharing a pooled buffer across goroutines without external synchronization
- `sync.Pool` entries are GC'd between benchmark iterations; reset state (`buf.Reset()`) before use
- Hoisting `[]byte("const")` out of a loop only helps if the loop body runs frequently — verify with `benchmem`

**Verify:** `go test -bench . -benchmem` shows reduced `allocs/op`; heap profile (`-memprofile`) confirms fewer live objects.

---

## Pattern 2b: Concurrency Optimization

Reduce lock contention and avoid unnecessary synchronization overhead.

**When:** Mutex contention appears in a mutex profile (`/debug/pprof/mutex`) or a benchmark shows throughput bottleneck on shared state.

**How:**

**Atomic operations for single-value counters:**
Use `sync/atomic` typed operations (Go 1.19+) for simple shared scalars — faster than a mutex for non-compound operations:

```go
import "sync/atomic"

type Counter struct{ n atomic.Int64 }

func (c *Counter) Inc()        { c.n.Add(1) }
func (c *Counter) Value() int64 { return c.n.Load() }
```

Limit atomics to simple load/store/add on a single field. For compound operations (read-then-write, multi-field updates) use a mutex.

**Sharded locks for high-contention maps:**
When a single `sync.RWMutex` on a map is the bottleneck, shard the map across N independent mutexes:

```go
const numShards = 256

type ShardedMap struct {
    shards [numShards]struct {
        mu    sync.RWMutex
        items map[string]any
    }
}

func (m *ShardedMap) shard(key string) *struct {
    mu    sync.RWMutex
    items map[string]any
} {
    h := fnv.New32()
    h.Write([]byte(key))
    return &m.shards[h.Sum32()%numShards]
}

func (m *ShardedMap) Get(key string) (any, bool) {
    s := m.shard(key)
    s.mu.RLock()
    defer s.mu.RUnlock()
    v, ok := s.items[key]
    return v, ok
}
```

**Pitfalls:**
- Reaching for atomics or sharding before the mutex profile confirms contention — premature complexity.
- Sharding with a poor hash distributes unevenly; benchmark with a representative key distribution.
- Compound atomic operations (e.g., check-then-set) require a mutex or `compare-and-swap` loop.

**Verify:** Mutex profile (`go tool pprof .../debug/pprof/mutex`) shows reduced contention; throughput benchmark (`go test -bench . -benchmem`) confirms improvement.

---

## Pattern 3: Escape Analysis & Inlining

Keep small, short-lived values on the stack by understanding how the compiler decides.

**When:** Heap profile shows unexpected allocations for small structs or values that look stack-local.

**How:**
- Inspect compiler decisions: `go build -gcflags=all='-m' ./...`
- Keep functions small to enable inlining (inlined callees don't need heap-allocated frames)
- Avoid returning a pointer to a local when the caller doesn't need the address; pass by value for small structs
- Interfaces cause escapes — avoid interface-boxing in loops

```bash
# Sample output — look for "escapes to heap" on hot allocations
go build -gcflags=all='-m -m' ./pkg 2>&1 | grep 'escapes to heap'
```

**Pitfalls:**
- Refactoring for stack placement without confirming the allocation is a measured bottleneck
- Relying on specific escape decisions across Go versions — the compiler may change heuristics
- Using `unsafe` to force stack allocation (undefined behavior, never do this)

**Verify:** `-gcflags=-m` output no longer shows the target allocation escaping; `benchmem` `allocs/op` drops.

---

## Pattern 3b: Algorithmic Improvements

Structural code changes often yield larger gains than low-level micro-optimizations.

**When:** Profile shows time spread across a loop body rather than concentrated in one call; or throughput is limited by N×M operations.

**How:**

**Early returns and fast paths:**
```go
// ✅ Skip work early — avoid expensive computation for common no-op cases
func process(items []Item) {
    for _, item := range items {
        if !item.IsValid() {
            continue // cheap check first
        }
        if item.IsSimple() {
            handleSimple(item) // fast path
            continue
        }
        handleComplex(item) // slow path only when needed
    }
}
```

**Batch operations:**
Reduce per-call overhead (network round-trips, syscalls, lock acquisitions) by processing multiple items in one call:
```go
// ❌ N round-trips
for _, item := range items { db.Insert(ctx, item) }

// ✅ 1 round-trip
db.BatchInsert(ctx, items)
```

**Zero-copy buffer reuse:**
Reset a slice to zero length while keeping its backing array, avoiding reallocation:
```go
type Parser struct{ buf []byte }

func (p *Parser) Parse(data []byte) {
    p.buf = p.buf[:0]          // reset length, keep capacity
    p.buf = append(p.buf, data...)
    // process p.buf ...
}
```

Stream directly to writers instead of building an intermediate `[]byte`:
```go
// ✅ Write directly — no intermediate allocation
json.NewEncoder(w).Encode(value)

// ❌ Allocates intermediate []byte
b, _ := json.Marshal(value)
w.Write(b)
```

**Pitfalls:**
- Fast-path branches that are never exercised add dead code and maintenance burden — verify with coverage.
- Batch sizes that are too large increase latency and memory pressure — benchmark with realistic data.
- Reusing `buf[:0]` is only safe when the caller does not retain a reference to the previous content.

**Verify:** Benchmark shows improvement proportional to reduced calls or allocations; profile confirms the hot path moved.

---

## Pattern 4: Tracing for Latency & Parallelism

Use the execution tracer to diagnose scheduler stalls, GC pauses, and goroutine blocking.

**When:** Tail latency spikes, work not spreading across cores, or GC STW pauses suspected.

**How:**
- Collect: `go test -trace trace.out ./pkg && go tool trace trace.out`
- In the trace UI, inspect:
  - **Goroutine states**: runnable (waiting for P) vs blocked (syscall/chan/mutex)
  - **GC events**: STW mark setup, mark termination pause durations
  - **Network poller**: time goroutines spend waiting on I/O
- For in-process tracing: use `runtime/trace` package with `trace.Start` / `trace.Stop`

**Pitfalls:**
- Using the tracer to find CPU hotspots — pprof is the right tool for that
- Long-running trace sessions produce large files that are slow to load
- Interpreting trace without understanding the Go scheduler (M:N model; P = logical processor)

**Verify:** Trace shows the blocking or pause event; fix is validated with a second trace or a latency histogram (p99 drops).

---

## Pattern 5: Runtime Metrics & Health Signals

Export Go runtime telemetry for production visibility into GC behavior, heap size, and goroutine health.

**When:** Setting up production monitoring, investigating memory growth, or designing GC-related alerts.

**How:**
- Use `runtime/metrics` (Go 1.16+) for structured, stable metric names:

```go
import "runtime/metrics"

samples := []metrics.Sample{
    {Name: "/gc/cycles/total:events"},
    {Name: "/memory/classes/heap/objects:bytes"},
    {Name: "/sched/goroutines:goroutines"},
}
metrics.Read(samples)
```

- Key signals to expose:
  - `/gc/cycles/total:events` — GC frequency
  - `/memory/classes/heap/objects:bytes` — live heap
  - `/memory/classes/heap/released:bytes` — memory returned to OS
  - `/sched/goroutines:goroutines` — goroutine count (leak detection)
  - `/cpu/classes/gc/total:cpu-seconds` — GC CPU cost
- Wire to Prometheus or your metrics backend; see `standards-observability` for infrastructure patterns

**Pitfalls:**
- Monitoring only RSS/VSZ — these miss GC dynamics and can lag heap behavior
- Ignoring `heap/released` — rising live heap with no release indicates growth
- Not tracking GC CPU fraction separately; it can dominate application CPU silently

**Verify:** Dashboards show stable trends under load; oncall runbook references these metrics and their alert thresholds.

---

## Pattern 5b: Runtime Tuning

Adjust Go runtime parameters when defaults are a measured bottleneck — not before.

**When:** CPU profiling shows scheduler overhead or goroutine stalls; or you need to tune memory behavior beyond `GOMEMLIMIT`.

**How:**

**GOMAXPROCS:**
- Default: `runtime.NumCPU()` — correct for most workloads.
- I/O-heavy services (waiting on network, disk) may benefit from a higher value; CPU-bound services rarely do.
- Set via env var: `GOMAXPROCS=16 ./myservice`, or programmatically: `runtime.GOMAXPROCS(n)`.
- In containers, the default reads host CPU count — consider `automaxprocs` (`go.uber.org/automaxprocs`) to read cgroup limits.

**debug.SetGCPercent:**
Controls the GC trigger ratio programmatically (same effect as `GOGC` env var):
```go
import "runtime/debug"

// Double heap budget before a known allocation spike
debug.SetGCPercent(200)
defer debug.SetGCPercent(100) // restore after
```
Use sparingly; prefer `GOGC` env var for persistent tuning and `GOMEMLIMIT` for container environments.

**runtime.MemStats for ad-hoc diagnostics:**
For one-off investigations when `runtime/metrics` is not yet wired up:
```go
var m runtime.MemStats
runtime.ReadMemStats(&m)
log.Printf("heap alloc=%d MB, sys=%d MB, GC cycles=%d",
    m.HeapAlloc>>20, m.Sys>>20, m.NumGC)
```
Prefer `runtime/metrics` in production (see Pattern 5); `MemStats` stops the world briefly.

**Pitfalls:**
- `runtime.GOMAXPROCS` called in library code affects the entire process — leave it to the application's `main`.
- `runtime.ReadMemStats` takes a STW snapshot — avoid calling it on hot paths or in tight loops.
- `debug.SetGCPercent` changes are process-wide; calling it from multiple goroutines simultaneously can produce unexpected results if the intent is to temporarily change and restore the value — serialize such calls.

**Verify:** Trace shows reduced scheduler stalls or lower P-idle time; benchmark confirms throughput improvement.

---

## Pattern 6: GC Tuning Guardrails

Tune the GC only after profiling shows GC is the bottleneck; wrong settings cause more harm than good.

> **Caveat:** GC guide advice applies to the standard `gc` toolchain (~Go 1.19+); behavior is not guaranteed by the language spec. For core language idioms see Effective Go (https://go.dev/doc/effective_go). For runtime internals, always measure on your workload.

**When:** GC CPU fraction dominates the CPU budget (visible in trace or `gctrace`) or running in memory-constrained containers.

**How:**
- Start with defaults (`GOGC=100`). Most services do not need tuning.
- Increase `GOGC` (e.g., `GOGC=200`) only when: memory headroom exists **and** GC CPU is the confirmed bottleneck. Higher GOGC → fewer GC cycles → larger heap.
- Set `GOMEMLIMIT` in containers to cap heap growth:

```bash
# Allow up to 800 MiB; container limit is 1 GiB (≥10% headroom)
GOMEMLIMIT=838860800 ./myservice
```

- Validate with `GODEBUG=gctrace=1`:

```
gc 14 @12.345s 2%: 0.1+2.1+0.3 ms clock, 0.8+1.5/2.0/0.1+2.4 ms cpu, 512->512->256 MB, 512 MB goal
```
  - Field 3 is GC CPU%; field 7 shows heap before→after→live; confirm pause times are acceptable.

**Pitfalls:**
- Setting `GOMEMLIMIT` too close to the container limit — the GC will thrash trying to stay under it
- Setting `GOGC=off` in shared environments — unbounded heap growth will OOM neighbors
- Tuning before measuring — `GOGC` and `GOMEMLIMIT` interact; always profile first

**Verify:** `gctrace` shows acceptable pause times (<1 ms STW for most services) and GC CPU % drops; no OOM or thrashing under sustained load.

---

## Pattern 7: Profile-Guided Optimization (PGO)

Feed a real production CPU profile back into the compiler to enable inlining and de-virtualization decisions that static analysis cannot make.

**When:** Service has been running in production long enough to have a representative CPU profile, and further micro-optimizations have been exhausted.

**How:**
1. Collect a CPU profile from a running production instance (see Pattern 1b):
   ```bash
   curl -o default.pgo 'http://localhost:6060/debug/pprof/profile?seconds=30'
   ```
2. Place `default.pgo` in the main package directory (Go 1.21+ auto-detects it):
   ```bash
   go build ./cmd/myservice        # Go 1.21+ picks up default.pgo automatically
   ```
   Or specify explicitly (Go 1.20+):
   ```bash
   go build -pgo=default.pgo ./cmd/myservice
   ```
3. Benchmark before and after with `benchstat` to confirm improvement.

**Pitfalls:**
- A profile from an atypical workload (e.g., load test, not real traffic) may optimize the wrong paths.
- PGO improves only what the compiler can do differently — it does not replace algorithmic improvements.
- The `default.pgo` file should be committed to source control and refreshed periodically as workload patterns change.

**Verify:** `go build -pgo=auto` succeeds; `benchstat` shows statistically significant improvement (typical: 5–15%); binary size may increase slightly due to more aggressive inlining.

---

## Skill Loading Triggers

| Situation | Also load |
|---|---|
| Latency / trace analysis | `standards-observability` |
| Writing performance benchmarks | `standards-go-testing` |
| Reviewing allocation-sensitive code | `role-code-review` |
| Concurrency lock contention | `standards-go-concurrency` |

## Verification Checklist

> For baseline formatting, vet, and go test checks see `standards-go`.

- [ ] Performance change justified by pprof or benchmark evidence (not intuition)
- [ ] Before/after benchmark numbers documented; `go test -bench . -benchmem` run
- [ ] Only one profile type collected per benchmark run (CPU and heap not simultaneous)
- [ ] Slices preallocated with known capacity; maps preallocated with `make(map[K]V, n)`
- [ ] `fmt.Sprint`/`Sprintf` replaced with `strconv` equivalents in hot loops (confirmed by benchmem)
- [ ] `sync.Pool` usage justified by benchmark; no cross-goroutine sharing without reset
- [ ] Escape analysis (`-gcflags=-m`) reviewed for unexpected heap escapes
- [ ] `GOMEMLIMIT` set with >=10% headroom below container memory limit
- [ ] `GOGC` changed only when GC CPU fraction is the measured bottleneck; gctrace reviewed after
- [ ] Runtime metrics exported; goroutine count alerting configured
- [ ] pprof HTTP endpoint bound to loopback/internal address only
- [ ] PGO profile collected from representative production traffic (not synthetic load)

Note: file list is sampled.
