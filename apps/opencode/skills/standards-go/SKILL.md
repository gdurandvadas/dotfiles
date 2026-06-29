---
name: standards-go
description: MUST load when writing or reviewing Go code; SHOULD load for Go architectural or API design decisions. Provides idiomatic Go patterns, error handling, resource management, generics, and design pattern guidance.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: go
  priority: high
---

# Go Standards

**Provides:** Idiomatic Go patterns, error handling, resource management, naming & package conventions, API type design, generics, and common design patterns. For concurrency, testing, and performance see the dedicated subskills.

**Primary references:**

- [Effective Go](https://go.dev/doc/effective_go)
- [Go CodeReviewComments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
- [Google Go Style Guide](https://google.github.io/styleguide/go/guide) / [Decisions](https://google.github.io/styleguide/go/decisions) / [Best Practices](https://google.github.io/styleguide/go/best-practices)

## Quick Reference

**Golden Rule**: Explicit is better than implicit; clarity beats cleverness

**Style principles (priority order):**

| Principle       | Key question                              |
| --------------- | ----------------------------------------- |
| Clarity         | Can a reader understand what and why?     |
| Simplicity      | Is this the simplest approach?            |
| Concision       | Is the signal-to-noise ratio high?        |
| Maintainability | Can this be safely modified later?        |
| Consistency     | Does this match surrounding code?         |

**Do**:

- Run `gofmt`/`goimports` on every save
- Use MixedCaps for identifiers; avoid underscores (exceptions: `Test*`/`Benchmark*`/`Example*` names in `*_test.go`, and rare low-level interop like `syscall`/cgo)
- Return `error` last; wrap with `%w`; check with `errors.Is`/`errors.As` (1.13+)
- `defer` release immediately after acquisition
- Pass `context.Context` as the first argument to blocking calls
- Accept interfaces, return concrete types
- Design zero values to be usable
- Use `any` instead of `interface{}` (1.18+)
- Prefer `slices`/`maps`/`cmp` packages over manual loops (1.21+/1.22+)
- Use `min`/`max` builtins instead of if/else comparisons (1.21+)

**Don't**:

- Hand-align code or use underscores in identifiers
- Stutter exported names (`bufio.BufReader` → use `bufio.Reader`)
- Discard errors with `_` silently
- Store `context.Context` in structs
- Use `panic` as flow control
- Use dot imports outside tests
- Name packages `util`, `common`, or `helpers`
- Use `interface{}` when `any` is available (1.18+)
- Write manual slice search/sort loops when `slices.*` applies (1.21+)
- Use `init()` for anything beyond simple, side-effect-free registration — prefer explicit initialization functions
- Use naked returns in functions longer than a few lines — name return values only when it genuinely aids clarity
- Define interfaces prematurely or in the implementing package — define at the point of use, as narrow as needed
- Use bare `string`/`int` as context value keys — define an unexported typed constant
- Use `http.NewRequest` for outbound calls that must respect a deadline — use `http.NewRequestWithContext`

**Key commands:**

```sh
gofmt -l .                        # list unformatted files (CI gate)
goimports -l .                    # also fixes import grouping
go vet ./...                      # catch common mistakes
golangci-lint run                 # run all configured linters
go test ./...                     # run all tests
go test -race ./...               # detect data races
go build -gcflags=all='-m' ./...  # escape analysis output
go mod tidy                       # remove unused deps, sync go.sum
GOOS=linux GOARCH=amd64 go build  # cross-compile
```

---

## Formatting & Tooling

- **gofmt / goimports**: Run on every save; CI must reject unformatted files (`gofmt -l .` produces no output). Use tabs for indentation — never hand-align or convert to spaces.
- **go vet**: Run `go vet ./...` in CI; treat all warnings as errors.
- **staticcheck / golangci-lint**: Use golangci-lint as the lint runner; configure once per repo and keep `.golangci.yml` in version control.
- **Editor integration**: Enable format-on-save using `goimports` (superset of `gofmt` — handles import grouping too).
- **go generate**: Use `//go:generate` directives to drive code generation (stringer, mockgen, protoc). Track generator tool dependencies in a `tools.go` file with a `//go:build tools` build constraint so `go mod tidy` sees them without including them in the binary.
- **pkgsite** (optional): Preview rendered godoc locally with `go install golang.org/x/pkgsite/cmd/pkgsite@latest && pkgsite` — confirms formatting of paragraphs, code blocks, and links before code review.

### Linting

Use [golangci-lint](https://github.com/golangci/golangci-lint) as the lint runner — it parallelises linters, caches results, and supports a single repo-wide config file (`.golangci.yml`).

**Minimum recommended linter set** (covers error handling, formatting, style, and common bugs):

| Linter | Purpose |
|--------|---------|
| `errcheck` | Ensure errors are handled |
| `goimports` | Format code and manage imports |
| `revive` | Style mistakes — modern, maintained replacement for the deprecated `golint` |
| `govet` | Common mistake analysis (same as `go vet`) |
| `staticcheck` | Advanced static analysis |

> **`golint` is deprecated — do not add it.** Use `revive` instead.

**Sample `.golangci.yml`** (place in project root):

```yaml
linters:
  enable:
    - errcheck
    - goimports
    - revive
    - govet
    - staticcheck

linters-settings:
  goimports:
    local-prefixes: github.com/your-org/your-repo
  revive:
    rules:
      - name: blank-imports
      - name: context-as-argument
      - name: error-return
      - name: error-strings
      - name: exported

run:
  timeout: 5m
```

Run linting with:

```sh
golangci-lint run          # lint all packages
golangci-lint run ./pkg/... # lint specific path
```

Add `golangci-lint run` to CI alongside `go vet ./...`; treat any finding as a build failure.

### Printf-Style Formatting

Store format strings in `const` so `go vet` can analyze them. Name `Printf`-style helpers with an `f` suffix.

### Import Grouping

Imports are organized in groups separated by blank lines: stdlib first, then external packages. `goimports` enforces this automatically. Google style adds groups for proto and side-effect imports.

### Blank Imports

`import _ "pkg"` imports for side effects only (driver registration, codec init). Restrict to `main` packages and test files.

## Code Style

### Reduce Nesting

Handle error cases and special conditions first; return early or `continue` to keep the happy path unindented.

### Avoid Unnecessary Else

When both branches of an `if` set the same variable, use a default + override pattern: `a := 10; if b { a = 100 }`.

### Line Length

There is no hard line-length limit in Go. Guidelines:

- Prefer to **refactor** when a line feels too long (shorter names help more than wrapping).
- If splitting is needed, put all arguments on their own lines (break by semantics, not length).
- Do not split long string literals (e.g., URLs) across lines.
- Uber's style guide suggests a soft limit of 99 characters; apply if the team adopts it.

### Indentation Confusion & Line Breaks

- Prefer keeping `if`/`for` conditions and function signatures on a single line.
- If a conditional is too long, extract well-named booleans rather than splitting the `if` line.
- Do not move `{` to the next line — Go's semicolon insertion makes this invalid.
- When splitting function signatures, put all arguments on their own lines with trailing commas.

### Parentheses

Go control structures (`if`, `for`, `switch`) do not take parentheses. The operator-precedence hierarchy is shorter and clearer than C/Java, so spacing is meaningful: `x<<8 + y<<16` means what it looks like. Add parentheses only to clarify non-obvious precedence.

### Local Consistency

When multiple styles are acceptable and no rule applies, match the style of the surrounding file/package. Do not introduce a second convention without a strong reason.

### Least Mechanism

Prefer the simplest tool that works:

1) core language constructs (struct/slice/map/channel)
2) standard library
3) well-adopted libraries

Add dependencies and abstraction only when they clearly improve correctness, simplicity at call sites, or performance.

### Signal Boosting

When code is intentionally unusual (looks like a common idiom but behaves differently), add a short comment to call attention to it (e.g., `if err == nil { // intentionally inverted }`).

### Control Flow Idioms

- **`if` with initializer**: scope short-lived variables to the block: `if err := file.Chmod(0664); err != nil { return err }`.
- **`:=` redeclaration rule**: a variable in the *same scope* can reappear on the left of `:=` if at least one other variable is new. **Shadowing trap**: `:=` in an inner scope creates a new variable — the outer one is silently unchanged.
- **`range` over strings iterates runes (not bytes)**: `for i, r := range s` yields Unicode code points; `i` is the byte offset.
- **Switch**: no implicit fallthrough; expression-less switch (`switch { case cond: }`) switches on `true`; comma-separated cases share a body; use **labeled break** to exit an enclosing loop from within a switch.

### Reduce Scope of Variables

Declare variables as close as possible to their use. Prefer `if`/`switch` initializers to keep temporary values scoped to the block, and avoid pre-declaring `var x` far above where it is used.

### Avoid Naked Parameters

Naked boolean parameters hurt readability. Add inline C-style comments at the call site (`printInfo("foo", true /* isLocal */, true /* done */)`) or replace `bool` parameters with small custom types/enums.

### Raw String Literals

Use raw string literals (backticks) to avoid hand-escaped strings: `` `unknown error:"test"` `` instead of `"unknown error:\"test\""`.

## Naming & Packages

- Package names: lowercase, single word, matches directory name. Avoid `util`, `common`, `helpers`, `misc`.
- Exported names must not stutter: `http.Client` not `http.HTTPClient`; `bufio.Reader` not `bufio.BufReader`.
- Use MixedCaps (camelCase / PascalCase) for identifiers; no underscores. Exceptions: `Test*`/`Benchmark*`/`Example*` in `*_test.go`; low-level OS/cgo interop.
- Getters named as the field: `Owner()` not `GetOwner()`; setters: `SetOwner(v)`. Use `Compute`/`Fetch` for expensive operations.
- Single-method interfaces: suffix with `-er` (`io.Reader`, `http.Handler`); define at point of use, not in the implementing package.
- Doc comments on every exported symbol: `// FunctionName does X.`

### Documentation (godoc)

- **Comment style**: Start with the name being documented; use a full sentence. Example: `// A Request represents a request to run a command.`
- **Package comment**: Every package needs exactly one; place it in `doc.go` for large packages.
- **Parameters / config**: Document only non-obvious behavior and edge cases.
- **Context cancellation**: Implied — document only when behavior differs.
- **Concurrency**: Read-only operations are assumed safe; mutating assumed unsafe. Add a note only when ambiguous.
- **Cleanup**: Always state when the caller must release a resource.
- **Errors**: Document sentinel errors and custom error types — use pointer form (`*PathError`) for `errors.As` targets.
- **Godoc formatting**: Blank line between paragraphs; indent code blocks by two extra spaces.

### Receiver Names

Receiver variables must be a short (one or two letter) abbreviation of the type, used consistently across all methods. Never use `this` or `self`.

### Initialisms and Acronyms

Initialisms (URL, ID, HTTP, etc.) must be cased uniformly — all uppercase when exported (`ParseURL`, `HTTPClient`), all lowercase when unexported (`userID`, `newHTTPClient`). Never mix cases (`userId`, `ParseUrl`, `HttpClient`).

Common initialisms: `ACL`, `API`, `ASCII`, `CPU`, `CSS`, `DNS`, `EOF`, `GUID`, `HTML`, `HTTP`, `HTTPS`, `ID`, `IP`, `JSON`, `LHS`, `QPS`, `RAM`, `RHS`, `RPC`, `SLA`, `SMTP`, `SQL`, `SSH`, `TCP`, `TLS`, `TTL`, `UDP`, `UI`, `UID`, `UUID`, `URI`, `URL`, `UTF8`, `VM`, `XML`, `XSRF`, `XSS`.

### Constant Naming

Constants use MixedCaps like all other identifiers. Never use `ALL_CAPS` or a `k` prefix. Names should express role, not value (`MaxRetries` not `Three`).

### Avoid Predeclared Names

Do not name variables, parameters, fields, or methods after Go's predeclared identifiers (`error`, `string`, `int`, `len`, `make`, `new`, `close`). Shadowing creates subtle bugs.

### Import Renaming

Aliases must be lowercase, no underscores. Avoid renaming unless there is a genuine name collision — prefer renaming the most local import. Generated proto packages: strip underscores, add `pb` suffix (e.g., `foosvcpb`). If the package name doesn't match the last path element (e.g., `client-go`), aliasing is required.

### Avoiding Repetition

Names should not feel redundant when read in full context. Consider the package qualifier, receiver type, and surrounding code: `widget.New()` not `widget.NewWidget()`; `db.Load()` not `db.LoadFromDatabase()`.

## API & Type Design

Keep APIs interface-friendly: accept interfaces, return concrete types, avoid pointers to interfaces, use `any` for placeholders. Design zero values to be usable.

### Struct Literals & Zero Values

- Prefer keyed struct literals by default. Positional struct literals are acceptable only in small, local table tests (3 fields or fewer) where meaning is obvious.
- Omit zero-value fields in keyed literals unless the field name adds meaningful context (common in table tests).
- When a value is truly the zero value, prefer `var t T` over `t := T{}`.
- Prefer `&T{...}` over `new(T)` for struct pointers (consistent with literal initialization).
- For multi-line literals, keep the closing brace aligned with the opening brace and include trailing commas; let `gofmt` handle formatting.
- In slice/map literals, omit repeated type names when it improves readability; `gofmt -s` can simplify many cases.

### Slice & Map Idioms

**`append` always returns a new slice header — always assign the result:**

```go
// Correct
items = append(items, newItem)
items = append(items, other...)

// Discards the result — may silently no-op when capacity grows
append(items, newItem)
```

**Nil vs empty slice** — prefer `var s []T` (nil slice) over `s := []T{}` (non-nil empty). Both have `len == 0` and work with `append`, `range`, etc. JSON exception: nil encodes to `null`; `[]T{}` encodes to `[]`.

When designing APIs, **do not distinguish** between a nil and a non-nil zero-length slice.

**Map comma-ok — always use the two-value form to detect presence:** `if v, ok := m[key]; ok { ... }`

**Set representation** — prefer `map[T]struct{}` over `map[T]bool`; zero-size values consume no heap.

**Copy slices and maps at API boundaries** — slices and maps hold pointers to underlying data; storing or returning them without copying leaks internal state. For Go 1.21+, prefer `slices.Clone` and `maps.Clone`:

```go
// Bad: caller can mutate d.trips
func (d *Driver) SetTrips(trips []Trip) { d.trips = trips }

// Good: defensive copy
func (d *Driver) SetTrips(trips []Trip) { d.trips = slices.Clone(trips) }

// Bad: exposes internal state
func (s *Stats) Snapshot() map[string]int { return s.counters }

// Good: return a copy
func (s *Stats) Snapshot() map[string]int { return maps.Clone(s.counters) }
```

### Type Safety Pitfalls

**Stringer recursion** — implementing `String() string` and calling `fmt.Sprintf("%s", receiver)` inside it causes infinite recursion because `%s` invokes `String()` again. Convert to the underlying type first:

```go
type MyString string

// Infinite recursion — %s calls String() on m (MyString)
func (m MyString) String() string {
    return fmt.Sprintf("MyString=%s", m)
}

// Convert to basic type to break the recursion
func (m MyString) String() string {
    return fmt.Sprintf("MyString=%s", string(m))
}
```

The same trap applies to any named type wrapping a type with a `String()` method (e.g., a named `[]byte`).

**Copying hazards** — do not copy a value of type `T` when its methods are defined on `*T`, or when it contains internal slices or sync primitives. Types to never copy: `bytes.Buffer`, `strings.Builder`, `sync.Mutex`, `sync.RWMutex`, `sync.WaitGroup`, `sync.Cond`, and any struct embedding them. `go vet` catches most violations via its `copylock` pass. Pass by pointer instead.

### Enum / Iota Values

Start iota-based enums at `iota + 1` so the zero value means "unset/unknown" and is distinguishable from a valid entry:

```go
// Zero means "uninitialized"
type Operation int

const (
    Add      Operation = iota + 1
    Subtract
    Multiply
)

// Exception: when zero is the meaningful default
type LogDestination int

const (
    LogToStdout LogDestination = iota // 0 = stdout is a sensible default
    LogToFile
)
```

### Time: Use `time.Time` and `time.Duration`

Represent instants with `time.Time` and durations with `time.Duration` — never raw `int` or `int64`. If a JSON/YAML schema forces a raw integer, include the unit in the field name (`IntervalMillis`, not `Interval`).

### Marshaling: Always Use Explicit Field Tags

Any struct serialized to JSON, YAML, TOML, etc. must carry explicit field tags. Without tags, renaming a Go field silently breaks the wire contract. Use `omitempty` (or `omitzero` on Go 1.24+) when absent fields should be omitted.

### Avoid Mutable Package-Level Globals

Mutable globals make code hard to test and reason about. Prefer **dependency injection** — pass dependencies as struct fields or constructor arguments. Read-only package-level vars (sentinel errors, compiled regexps, `sync.Once`-initialized values) are fine.

### Cryptographically Secure Randomness

Never use `math/rand` (or `math/rand/v2`) for keys, tokens, session IDs, or security-sensitive values. Use `crypto/rand` instead — on Go 1.22+, `rand.Text()` returns a base32-encoded random string.

> **Security**: See `standards-security` for broader guidance.

### Functional Options

Use functional options when a constructor or public API has **3+ independent optional parameters** or when the API is expected to grow new options over time. Prefer a plain config struct when options are few, all usually specified together, or the API is internal-only.

The preferred pattern (Uber style) uses an **exported `Option` interface** with an **unexported `apply` method** so only this package can implement it. This enables options to be compared in tests, implement `fmt.Stringer` for debugging, and appear as named types in generated documentation — advantages closures (`type Option func(*options)`) do not provide. Closure-based options are acceptable for small or package-internal APIs where those benefits are not needed.

```go
// options holds all configuration; unexported.
type options struct {
    port    int
    timeout time.Duration
}

// Option is the public handle; unexported apply prevents external implementations.
type Option interface {
    apply(*options)
}

type portOption int

func (p portOption) apply(o *options) { o.port = int(p) }

// WithPort sets the listening port.
func WithPort(p int) Option { return portOption(p) }

type timeoutOption struct{ d time.Duration }

func (t timeoutOption) apply(o *options) { o.timeout = t.d }

// WithTimeout sets the request timeout.
func WithTimeout(d time.Duration) Option { return timeoutOption{d} }

// NewServer creates a server, applying opts over safe defaults.
func NewServer(opts ...Option) *Server {
    o := options{port: 8080, timeout: 30 * time.Second}
    for _, opt := range opts {
        opt.apply(&o)
    }
    return &Server{port: o.port, timeout: o.timeout}
}
```

### Receiver Type Selection

Use a **pointer receiver** when the method mutates the receiver, the struct contains a `sync.Mutex` or similar, or the struct is large. Use a **value receiver** when the type is small and immutable (e.g., `time.Time`, `Point`), or field types are maps/funcs/chans (already references).

**Consistency rule**: if any method needs a pointer receiver, use pointer receivers for _all_ methods on that type.

**Pitfall**: values in maps are not addressable — store `map[K]*T` if the type needs pointer receivers.

> **When in doubt, use a pointer receiver.**

### Interface Satisfaction Check

Use a blank-identifier compile-time assertion to ensure a type implements an interface — catches drift without a runtime test:

```go
var _ io.Reader   = (*MyReader)(nil)
var _ io.Writer   = (*MyWriter)(nil)
var _ http.Handler = (*MyHandler)(nil)
```

### Type Assertions & Type Switches

Always use the two-value form (`v, ok := x.(T)`) to avoid panics. Use type switches for exhaustive branching. The single-value form panics on mismatch — avoid in production code. Type switch cases can match both concrete and interface types.

### io.Reader / io.Writer Composition

Prefer stdlib composable primitives over bespoke wrappers: `io.MultiReader`, `io.TeeReader`, `io.LimitReader`, `io.MultiWriter`.

### Composition via Embedding

Go favors **composition over inheritance**. Embedding promotes methods to the outer type.

- **Interface embedding**: combine interfaces (`type ReadWriter interface { Reader; Writer }`).
- **Struct embedding**: promote concrete methods (`type ReadWriter struct { *Reader; *Writer }`).
- Access embedded fields using the unqualified type name as the field name.
- Define the same method on the outer type to override/intercept.
- An outer field/method always hides the same name from embedded types.
- The receiver of a promoted method is the **inner** type, not the outer — no implicit `super`.

> **Caution — avoid embedding in exported structs**: embedding leaks the full API of the embedded type. Adding/removing methods on the embedded type becomes a breaking change. Prefer a **named private field + explicit forwarding methods** so you control the public surface. Embedding is fine for **unexported** structs and for interface composition.

## Design Patterns

Prefer the simplest option that fits the problem.

### Builder

Use a fluent builder when constructing an object requires many optional, ordered steps (query builders, HTTP clients, test fixtures). Prefer functional options when parameters are independent and order doesn't matter.

### Strategy

Swap algorithms behind an interface without changing the caller. Keep strategy interfaces small — a single method is ideal. This is the natural result of Go's "accept interfaces" idiom.

### Observer

Notify multiple subscribers about events without tight coupling. For high-throughput event streams prefer channels (see `standards-go-concurrency`). Use struct-based observer when subscribers need dynamic registration.

## Project Structure

```
cmd/myapp/main.go    # Minimal — wire dependencies and call into internal packages
internal/            # Private packages; cannot be imported by external modules
pkg/                 # Public library code (optional; omit if all consumers are internal)
api/                 # API definitions (OpenAPI specs, protobuf files)
configs/             # Configuration files
testdata/            # Test fixtures; ignored by go build
```

- Keep `main` packages thin — business logic belongs in `internal/`.
- Prefer `internal/` over `pkg/` unless you intentionally publish an importable API.
- `testdata/` is the conventional home for golden files, fixtures, and fuzz corpora.

### File Organization

- Group declarations: `import (...)`, then `const (...)`, `var (...)`, `type (...)` when related.
- Keep functions grouped by receiver; keep exported APIs first.
- Place constructors (`NewT`/`newT`) right after the type definition, before methods.
- Keep plain helper functions (no receiver) near the end of the file.

### Workspaces (`go work`)

Use Go workspaces for monorepos with multiple modules that need to share local changes without `replace` directives:

```bash
go work init ./services/api ./services/worker
go work use ./shared/models   # add module
go work sync                  # sync go.sum files
```

The `go.work` file must not be committed to repos where each module is versioned independently.

### Build Tags

Use `//go:build` (Go 1.17+ syntax; `// +build` is the legacy form) to gate files by platform, environment, or test category:

```go
//go:build integration          // file only compiled when -tags=integration
//go:build linux || darwin       // platform constraint
//go:build !windows              // negation
```

Run integration tests explicitly: `go test -tags=integration ./...`; skip slow tests in CI: `go test -short ./...` (guard with `testing.Short()`).

### Version Embedding via `ldflags`

Bake build metadata into binaries at link time — no config file required:

```bash
go build -ldflags "-X main.version=1.2.3 \
  -X main.commit=$(git rev-parse --short HEAD) \
  -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" ./cmd/myapp
```

Declare the vars as `var version, commit, buildTime string` in the target package.

## Error Handling

- Return `error` as the last return value. Never discard with `_` without an explanatory comment.
- Wrap errors for context: `fmt.Errorf("open config: %w", err)`. Use `%w` (not `%v`) so callers can unwrap.
- Check wrapped errors with `errors.Is(err, target)` (1.13+) and `errors.As(err, &target)` (1.13+) — never use `==` for wrapped errors. In Go 1.26+, prefer `errors.AsType[T](err)` over `errors.As`.
- Sentinel errors: declare as package-level vars — `var ErrFoo = errors.New("foo")` — so callers can match without string comparison.
- Combine multiple errors with `errors.Join(err1, err2)` (1.20+) instead of manual concatenation.
- **Custom error types**: Define a struct implementing `error` when callers need to inspect structured fields (e.g., HTTP status code, field name). Implement `Error() string`; use `errors.As` to unwrap at the call site. Keep error types in the same package as the functions that return them.
- `panic` is program-fatal. Use `recover` only at package or handler boundaries (e.g., HTTP middleware). Never use panic/recover as a substitute for returning errors.

### Return the `error` Interface, Not a Concrete Type

Always return the `error` interface from exported functions. Returning a concrete type (e.g., `*os.PathError`) creates a typed-nil trap: a nil pointer compares non-nil as an interface value.

### Error Strings

Error strings should be **lowercase** and should **not** end with punctuation. Exception: capitalize when beginning with an exported name or proper noun.

### Avoid In-Band Errors

Do not use magic sentinel values (`-1`, `""`, `nil`) to signal failure. Use multiple return values: `func Lookup(key string) (string, bool)` or `func Parse(key string) (int, error)`.

### Indent Error Flow

Handle errors first and return early; do not put the normal path in an `else` branch. Avoid `if x, err := f(); err != nil { ... } else { use x }` — declare `x` separately when it lives beyond a few lines.

### `%v` vs `%w`

| Use `%w` | Use `%v` |
|----------|----------|
| Propagating an error up the call stack so callers can inspect it with `errors.Is`/`errors.As` | System/service boundaries where internal details should not leak |
| Adding call-site context within a single service | Logging or metrics (observability consumers don't unwrap) |
| | Redacting or transforming the error before exposing it |

```go
// %w: callers can match ErrNotFound through the chain
return fmt.Errorf("get user %s: %w", id, err)

// %v: boundary — no need for callers to unwrap an internal DB error
return fmt.Errorf("user service unavailable: %v", err)
```

### Handle Errors Once

Each error must be handled exactly **once**. Never log *and* return the same error.

| Strategy | When to use |
|----------|-------------|
| **Wrap and return** | Caller is better positioned to handle it |
| **Log and degrade** | The error is non-fatal; execution can continue |
| **Match and handle** | You can recover from specific conditions; return others |

```go
// Wrap and propagate with errors.Is / errors.As
if err := db.QueryRow(ctx, q, id).Scan(&u); err != nil {
    if errors.Is(err, sql.ErrNoRows) {
        return nil, ErrNotFound
    }
    return nil, fmt.Errorf("get user %s: %w", id, err)
}

// Type-asserting an error (1.26+)
if pathErr, ok := errors.AsType[*os.PathError](err); ok {
    log.Println(pathErr.Path)
}
```

```go
// Custom error type with structured fields
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

var valErr *ValidationError
if errors.As(err, &valErr) {
    log.Printf("invalid field: %s", valErr.Field)
}
```

### init() Rules

Avoid `init()` — prefer an explicit initialization function called by `main()`. When unavoidable (e.g., `database/sql` driver registration), `init()` must be: completely deterministic, free of ordering dependencies, must not read env vars or `os.Args`, and must not perform I/O.

### Exit and log.Fatal

Call `os.Exit` or `log.Fatal*` **only in `main()`**. All other functions must return errors. Prefer the `run() error` pattern:

```go
func main() {
    if err := run(); err != nil {
        log.Fatal(err)
    }
}

func run() error {
    // ... business logic returning errors ...
    return nil
}
```

## Resource Management

- `defer` release **immediately** after acquisition: `f, err := os.Open(name); if err != nil { ... }; defer f.Close()`.
- Deferred call arguments are evaluated at the `defer` statement, not at call time.
- Pass `context.Context` as the **first argument** to blocking/cancellable functions. Do not store context in structs.
- Check errors from `Close()` on write paths (e.g., `gzip.Writer`, `bufio.Writer`).

### Context Patterns

- **No custom context types.** Always accept `context.Context`; embedding extra methods breaks composability.
- **Data placement order**: function parameters → receiver fields → package-level globals → context values. Context values are only for request-scoped, cross-cutting data (request IDs, trace IDs, auth tokens).
- **Context immutability**: safe to pass the same `ctx` to multiple sequential or concurrent calls.
- **`context.Background()`**: only at program entry points (`main`, top-level goroutines, tests). Everywhere else, accept and forward `ctx`.
- **Always `defer cancel()`** immediately after deriving a context.
- **Use `http.NewRequestWithContext`** (never `http.NewRequest`) so outbound requests respect the caller's deadline.

**Typed context keys** — never use bare string or int as a key:

```go
// Unexported type scoped to this package — impossible for other packages to collide
type contextKey string

const (
    requestIDKey contextKey = "requestID"
    userIDKey    contextKey = "userID"
)

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, requestIDKey, id)
}

func RequestID(ctx context.Context) (string, bool) {
    id, ok := ctx.Value(requestIDKey).(string)
    return id, ok
}
```

## Generics (1.18+)

Use generics to eliminate redundant code over multiple types without sacrificing type safety. Prefer concrete types and interfaces first; reach for generics only when the same logic truly applies to multiple unrelated types.

- **Type parameters** use `[T constraint]` syntax; `any` means unconstrained.
- **`comparable`** allows `==` and `!=`; required for map keys and `Find`-style functions.
- **`constraints.Ordered`** (from `golang.org/x/exp/constraints`, or define inline) allows `<`, `>`, etc.
- **`~T`** (approximate constraint) includes all types whose underlying type is `T` — covers type aliases.
- **Union constraints** (`int | string`) restrict a parameter to a fixed set of types.
- **Type inference** works for function parameters; specify explicitly only when ambiguous.

```go
// Generic Map/Filter — remove boilerplate over typed slices
func Map[T, U any](s []T, fn func(T) U) []U {
    out := make([]U, len(s))
    for i, v := range s { out[i] = fn(v) }
    return out
}

func Filter[T any](s []T, keep func(T) bool) []T {
    out := make([]T, 0, len(s))
    for _, v := range s {
        if keep(v) { out = append(out, v) }
    }
    return out
}

// Comparable constraint — enables generic lookup
func Contains[T comparable](s []T, v T) bool {
    for _, x := range s {
        if x == v { return true }
    }
    return false
}

// Approximate constraint — works for named int types too
type Signed interface { ~int | ~int8 | ~int16 | ~int32 | ~int64 }

func Abs[T Signed](n T) T {
    if n < 0 { return -n }
    return n
}
```

**Pitfalls:**
- Avoid generic data structures (generic `Stack`, `Queue`) unless the `slices`/`maps` stdlib packages don't cover the need — the standard library covers most cases since 1.21.
- Do not use `any` as a substitute for proper interface design; `any` parameters lose type information at the call site.
- The `constraints` package (`golang.org/x/exp`) is not in stdlib — define inline constraints for simple union types to avoid adding a dependency.

> **Note:** Effective Go (https://go.dev/doc/effective_go) was written for Go's 2009 release and has not been significantly updated; use it for core language idioms, not modern ecosystem guidance (modules, generics, tooling). GC and runtime guidance applies to the standard `gc` toolchain and is not guaranteed by the language spec.

---

## Modern Go by Version

> Check the project's Go version before applying: `grep -rh "^go " --include="go.mod" . | head -1`
> Use ALL features up to and including that version; never use features from newer versions.
>
> **Note:** Version-specific behavior (especially runtime, GC, and toolchain features) should be verified against the official [Go release notes](https://go.dev/doc/devel/release) — not all changes are reflected in language specifications.

### 1.21+

- `min(a, b)` / `max(a, b)` builtins — instead of if/else
- `clear(m)` / `clear(s)` — delete all map entries or zero slice elements
- `slices.Contains` / `slices.Index` / `slices.IndexFunc` — replace manual search loops
- `slices.Sort` / `slices.SortFunc` / `slices.Max` / `slices.Min` / `slices.Reverse` / `slices.Compact` / `slices.Clone` / `slices.Clip`
- `maps.Clone(m)` / `maps.Copy(dst, src)` / `maps.DeleteFunc` — replace manual map iteration
- `sync.OnceFunc(fn)` / `sync.OnceValue(fn)` — cleaner one-time initialization than `sync.Once`
- `context.AfterFunc(ctx, fn)` — run cleanup on cancellation
- `context.WithTimeoutCause` / `context.WithDeadlineCause`

### 1.22+

- `for i := range n` — instead of `for i := 0; i < n; i++`
- **Loop variable capture fixed** — each iteration now has its own variable; goroutines in loops are safe without capture workaround
- `cmp.Or(a, b, c, "default")` — returns first non-zero value; replaces chains of `if x == "" { x = fallback }`
- `reflect.TypeFor[T]()` — instead of `reflect.TypeOf((*T)(nil)).Elem()`
- `http.ServeMux` method+path patterns: `mux.HandleFunc("GET /api/{id}", h)` + `r.PathValue("id")`

### 1.23+

- `maps.Keys(m)` / `maps.Values(m)` — now return iterators (use with `for k := range maps.Keys(m)`)
- `slices.Collect(iter)` — build slice from iterator without manual loop
- `slices.Sorted(iter)` — collect + sort in one step
- `time.Tick` — GC can now recover unreferenced tickers; `NewTicker` no longer required for GC safety

### 1.24+

- `t.Context()` in tests — instead of `context.WithCancel(context.Background())` + `defer cancel()`
- `omitzero` JSON tag — use instead of `omitempty` for `time.Duration`, `time.Time`, structs, slices, maps
- `b.Loop()` in benchmarks — instead of `for i := 0; i < b.N; i++`
- `strings.SplitSeq(s, sep)` / `strings.FieldsSeq(s)` — iterator variants; use when iterating split results in for-range (avoids allocating a full slice)

### 1.25+

- `wg.Go(fn)` on `sync.WaitGroup` — instead of `wg.Add(1)` + `go func() { defer wg.Done(); ... }()`

### 1.26+

- `new(val)` — accepts expressions (not just types); `new(30)` → `*int`, `new(true)` → `*bool`, `new(T{})` → `*T`; replaces `x := val; &x`
- `errors.AsType[T](err)` — instead of `errors.As(err, &target)` with a pre-declared var; returns `(T, bool)` inline

---

## Skill Loading Triggers

| Situation                                    | Also load                                              |
| -------------------------------------------- | ------------------------------------------------------ |
| Writing any Go code                          | `standards-code`                                       |
| Writing Go tests, benchmarks, fuzz tests     | `standards-go-testing`, `standards-testing`            |
| Goroutines, channels, sync, context patterns | `standards-go-concurrency`                             |
| Profiling, tracing, allocation, GC tuning    | `standards-go-performance`, `standards-observability`  |
| Auth, secrets, user input, crypto            | `standards-security`                                   |
| Implementing features/fixes (TDD)            | `role-developer`                                       |
| API/package/service design                   | `role-architect`                                       |
| Go PR review                                 | `role-code-review`                                     |

## Verification Checklist

- [ ] `gofmt -l .` produces no output (zero unformatted files)
- [ ] `go vet ./...` passes with no warnings
- [ ] All exported symbols have doc comments
- [ ] `go test ./...` passes
- [ ] `go test -race ./...` passes for any code touching goroutines
- [ ] Errors not silently discarded; wrapped with `%w` for context where appropriate
- [ ] Error strings are lowercase with no trailing punctuation
- [ ] No in-band error values (`-1`, `""`, `nil`); use multiple return values instead
- [ ] Every resource acquisition has a paired `defer` release
- [ ] `context.Context` is first arg to blocking/cancellable functions; not stored in structs
- [ ] No positional composite literals for multi-field structs
- [ ] Package names are lowercase, single-word, stutter-free
- [ ] Modern Go APIs used where available (check `go.mod` version; prefer `slices`/`maps`/`cmp`, `any`, `min`/`max`, `t.Context()`, `b.Loop()`)
- [ ] Generic functions constrained to the minimum required (`comparable`, `Ordered`, union, or `any`)
- [ ] Compile-time interface satisfaction checks (`var _ Iface = (*T)(nil)`) present for key types
- [ ] `go mod tidy` run; no unused dependencies
- [ ] Build tags use `//go:build` syntax (not legacy `// +build`)
- [ ] Outbound HTTP requests use `http.NewRequestWithContext` (not `http.NewRequest`)
- [ ] Context value keys use an unexported typed constant (not bare string/int)
- [ ] No custom context interface types in function signatures — always `context.Context`
- [ ] `context.Background()` used only at program entry points; ctx accepted even when not yet used
- [ ] Custom error types implement `error` and are unwrapped with `errors.As`
- [ ] Slices and maps are copied (not aliased) when received from or returned to callers at API boundaries
- [ ] Iota enums start at `iota + 1` unless zero is a meaningful default
- [ ] Time values use `time.Time` / `time.Duration`; raw-int fields include the unit in their name
- [ ] All marshaled structs carry explicit `json:` / `yaml:` field tags
- [ ] No mutable package-level globals; dependencies are injected
- [ ] Exported structs do not embed types that leak API surface; named fields + forwarding methods used instead
- [ ] Keys, tokens, and IDs are generated with `crypto/rand`, never `math/rand`

Note: file list is sampled.
