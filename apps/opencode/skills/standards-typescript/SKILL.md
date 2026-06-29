---
name: standards-typescript
description: MUST load when writing or reviewing TypeScript; SHOULD load for TS API design. Provides idiomatic patterns, type system, naming, and Google TS Style Guide rules.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: typescript
  priority: high
---

# TypeScript Standards

**Provides:** Idiomatic TypeScript patterns, type system usage, imports/exports, naming conventions, JSDoc rules, formatting, and a complete disallowed-features reference. Based on the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html).

**Primary references:**

- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

## Quick Reference

**Golden Rule**: Prefer type inference; use explicit annotations at boundaries and wherever the type is non-obvious

**Style principles (priority order):**

| Principle       | Key question                                     |
| --------------- | ------------------------------------------------ |
| Correctness     | Does the type system catch bugs at compile time? |
| Clarity         | Can a reader understand the intent?              |
| Simplicity      | Is this the simplest type-safe approach?         |
| Consistency     | Does this match surrounding code?                |

**Do** (✅):

- `const` by default; `let` if reassigned; never `var`
- Named exports only; no default exports
- `import type {Foo}` for type-only imports
- `unknown` over `any`; narrow explicitly with type guards
- `private` keyword for private class members (not `#private`)
- `readonly` on non-reassigned properties
- `===` / `!==`; exception: `== null` checks both null+undefined
- `as Foo` for type assertions (not `<Foo>`)
- `throw new Error(...)` only; never throw strings/literals
- `catch (e: unknown)` and assert `e instanceof Error` before use
- `interface` for structural types; avoid `class` for pure data shapes
- Treat acronyms as words: `loadHttpUrl` not `loadHTTPURL`

**Don't** (❌):

- `var`, `new Array()`, `new Object()`
- Default exports
- `export let` (mutable named exports)
- `#private` fields
- `any` (prefer `unknown`)
- `const enum`
- `with`, `eval`, `Function(...string)`
- Wrapper object instantiation (`new String()`, `new Boolean()`, `new Number()`)
- `debugger` in production
- `parseInt`/`parseFloat` without radix validation — use `Number()` + `isNaN`
- Unary `+` for string-to-number coercion

**Key commands:**

```sh
npx tsc --noEmit           # type-check without emitting
npx eslint --ext .ts .     # lint TypeScript files
npx prettier --check .     # check formatting
npx prettier --write .     # auto-format
```

**Recommended `tsconfig` flags:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## Source File Structure

File order (blank line between each section):

1. Copyright/license comment (if applicable)
2. `@fileoverview` JSDoc (if applicable)
3. Imports
4. Implementation

- UTF-8 encoding; use actual Unicode characters — not escape sequences — for printable chars (e.g., `const pi = 'π'`, not `'\u03C0'`).

```typescript
// ✅ Correct file structure
/**
 * @fileoverview Utilities for processing user data.
 */

import {processUser} from './user-processor';
import type {User} from './types';

export function formatUser(user: User): string {
  return processUser(user).displayName;
}
```

---

## Imports & Exports

### Imports

- Use ES module `import`/`export`; **never** `require()`, CommonJS patterns, `namespace`, or `/// <reference>`.
- **Named imports** for frequently used symbols; **namespace imports** (`import * as foo`) for large APIs where many symbols are used.
- **Relative paths** for project-internal code (`./foo`, `../bar`); module paths for packages.
- `import type {Foo}` for type-only imports — erased at compile time, avoids circular deps.

```typescript
// ✅ Named import
import {Component, OnInit} from '@angular/core';

// ✅ Namespace import for large API
import * as path from 'path';

// ✅ Type-only import
import type {User} from './types';

// ❌ require — never use in TS
const fs = require('fs');

// ❌ reference directive — never use
/// <reference path="..." />
```

### Exports

- **Named exports only** — no default exports.
- `export const` not `export let` (mutable named exports are banned).
- `export type {Foo}` for type re-exports.
- No container classes with only static methods — use module-level named exports instead.

```typescript
// ✅ Named exports
export const MAX_RETRIES = 3;
export function processUser(user: User): ProcessedUser { ... }
export type {ProcessedUser};

// ❌ Default export — never
export default class UserService { ... }

// ❌ Mutable export
export let counter = 0;

// ❌ Container class as namespace — use standalone exports instead
export class Utils {
  static formatDate(d: Date): string { ... }
}
// ✅ Instead:
export function formatDate(d: Date): string { ... }
```

---

## Variables

- `const` by default; `let` if the binding is reassigned; **never `var`**.
- One declaration per line.
- No use before declaration.

```typescript
// ✅
const maxRetries = 3;
let attempt = 0;

// ❌
var count = 0;          // no var
let a = 1, b = 2;      // no multiple declarations
```

---

## Arrays

- Never `new Array()` — use `[]` literals.
- Spread for shallow copy/concat: `[...foo, ...bar]`.
- `for...of` to iterate; destructuring for unpacking.

```typescript
// ✅
const items: string[] = [];
const copy = [...original];
const combined = [...arr1, ...arr2];
for (const item of items) { ... }
const [first, second, ...rest] = items;

// ❌
const bad = new Array(3);
for (let i = 0; i < items.length; i++) { ... }  // prefer for...of
```

---

## Objects

- Never `new Object()` — use `{}` literals.
- Spread for shallow copy: `{...base, override: value}`.
- `for...of Object.keys()` / `Object.values()` / `Object.entries()` instead of `for...in`.
- Destructuring with defaults: `const {str = 'default'} = obj`.

```typescript
// ✅
const config = {host: 'localhost', port: 8080};
const updated = {...config, port: 9090};
for (const [key, value] of Object.entries(config)) { ... }
const {host = 'localhost', port = 8080} = options;

// ❌
const bad = new Object();
for (const key in obj) { ... }   // use Object.keys/values/entries instead
```

---

## Classes

- Use TypeScript `private` keyword — **no `#private` fields**.
- Mark non-reassigned properties `readonly`.
- Use parameter properties: `constructor(private readonly svc: UserService) {}`.
- Initialize fields at declaration, not in the constructor body.
- Getters must be pure — no side effects, no observable state changes.
- **Never** use the `public` modifier unless it's a non-readonly public parameter property.
- **No `prototype` manipulation.**
- No trailing semicolons after class declarations; blank lines between method declarations.

```typescript
// ✅
class UserService {
  private readonly cache = new Map<string, User>();
  private requestCount = 0;

  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  async getUser(id: string): Promise<User> {
    this.requestCount++;
    return this.db.find(id);
  }
}

// ❌
class BadService {
  public name: string;          // no public modifier needed
  #secret = 'value';            // no #private fields
  private count: number;        // initialize at declaration instead
  constructor() {
    this.count = 0;             // initialize at declaration
  }
}
BadService.prototype.extra = () => {};  // no prototype manipulation
```

---

## Functions

- **Prefer function declarations** for named top-level functions.
- **Prefer arrow functions** for callbacks and inline functions; never named function expressions (use arrow instead).
- Arrow function body: `{ }` block when return value is unused; concise body when return value is used.
- Use rest params instead of `arguments`; spread instead of `Function.apply`.
- **Never `bind()` in event listener registration** — use arrow function properties for stable uninstall references.
- **Never use `this` outside class methods, constructors, or arrow functions.**

```typescript
// ✅ Top-level: function declaration
function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

// ✅ Callback: arrow function with concise body (return value used)
const names = users.map(u => u.name);

// ✅ Arrow function with block body (return value unused)
users.forEach(u => {
  processUser(u);
});

// ✅ Rest params instead of arguments
function sum(...nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

// ✅ Arrow property for stable event handler reference
class Component {
  private readonly handleClick = () => {
    this.doSomething();
  };

  mount() {
    button.addEventListener('click', this.handleClick);
  }

  unmount() {
    button.removeEventListener('click', this.handleClick);
  }
}

// ❌ Named function expression — use arrow instead
const format = function formatUser(u: User) { return u.name; };

// ❌ bind in listener registration
button.addEventListener('click', this.handleClick.bind(this));
```

---

## Control Flow

- Always use braces `{}` for control flow blocks (exception: single-line `if` on one line is acceptable).
- `===` / `!==`; use `== null` only to check both `null` and `undefined` together.
- `switch` must have a `default` case (last); no fallthrough in non-empty cases.
- `throw new Error(...)` — never throw strings or plain objects; only `Error` subclasses.
- `catch (e: unknown)` — assert `e instanceof Error` before accessing properties.
- Empty catch blocks require an explanatory comment.
- Type assertions: `as Foo` not `<Foo>`.

```typescript
// ✅ Equality
if (value === null) { ... }
if (value == null) { ... }    // ok: catches both null and undefined

// ✅ switch with default
switch (status) {
  case 'active':
    return handleActive();
  case 'inactive':
    return handleInactive();
  default:
    throw new Error(`Unknown status: ${status}`);
}

// ✅ Error handling
try {
  await fetchData();
} catch (e: unknown) {
  if (e instanceof Error) {
    logger.error(e.message);
  }
  throw e;
}

// ✅ Type assertion
const input = event.target as HTMLInputElement;

// ❌ Never throw non-Error
throw 'something went wrong';
throw {code: 404, message: 'Not found'};

// ❌ Old-style assertion syntax
const input = <HTMLInputElement>event.target;
```

### Double Assertions

When a double assertion is unavoidable, use `unknown` as the intermediate:

```typescript
// ✅
const foo = bar as unknown as Foo;

// ❌
const foo = bar as any as Foo;
```

---

## Type System

### Inference & Annotations

- **Rely on type inference** — don't annotate trivially-inferred types.
- **Annotate** when the type is non-obvious: complex async expressions, empty generics, public API return types.

```typescript
// ✅ Inferred — no annotation needed
const isActive = true;
const count = 42;
const users = new Map<string, User>();  // explicit generic needed

// ✅ Annotate non-obvious type
const result: Promise<ProcessedUser[]> = processAll(users);

// ❌ Over-annotated trivially-inferred types
const isActive: boolean = true;
const count: number = 42;
```

### `unknown` vs `any`

- **Avoid `any`** — use `unknown` and narrow explicitly.
- Never use `object` (use `{}`, a specific type, or `Record<string, unknown>`).

```typescript
// ✅
function parseResponse(data: unknown): User {
  if (!isUser(data)) throw new Error('Invalid user data');
  return data;
}

function isUser(val: unknown): val is User {
  return typeof val === 'object' && val !== null && 'id' in val;
}

// ❌
function parseResponse(data: any): User {
  return data as User;   // unsafe cast, no validation
}
```

### Interfaces vs Types

- Use **interfaces** for structural/object types.
- Use **type aliases** for unions, intersections, and mapped types.
- Never use a `class` purely as a structural type — use an interface.

```typescript
// ✅ Interface for structural type
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ Type alias for union
type Status = 'active' | 'inactive' | 'pending';

// ✅ Type alias for mapped type
type ReadonlyUser = Readonly<User>;

// ❌ Class as structural type
class UserShape {
  id!: string;
  name!: string;
}
```

### Null & Optional

- Use `undefined` or `null` contextually; never add `|null` or `|undefined` to type aliases.
- Prefer optional `?` over explicit `|undefined` for parameters and fields.

```typescript
// ✅ Optional parameter
function greet(name?: string): string {
  return `Hello, ${name ?? 'stranger'}`;
}

// ✅ Optional field
interface Config {
  host: string;
  timeout?: number;
}

// ❌ Explicit undefined in union where optional works
function greet(name: string | undefined): string { ... }

// ❌ Union in type alias
type MaybeUser = User | null;  // don't add null to aliases
```

### Enums

- Use plain `enum` — `const enum` is **banned**.

```typescript
// ✅
enum Direction {
  Up = 'UP',
  Down = 'DOWN',
  Left = 'LEFT',
  Right = 'RIGHT',
}

// ❌ const enum — banned
const enum Direction { Up, Down }
```

### Wrapper Objects

- **Never** use wrapper object instantiation.

```typescript
// ❌ All of these are banned
const s = new String('hello');
const b = new Boolean(true);
const n = new Number(42);

// ✅ Use primitives
const s = 'hello';
const b = true;
const n = 42;
```

---

## Naming

| Identifier | Convention | Examples |
|---|---|---|
| Class, Interface, Type, Enum | `UpperCamelCase` | `UserService`, `HttpClient`, `Direction` |
| Variable, Parameter, Function, Method, Property | `lowerCamelCase` | `userId`, `getUser`, `isActive` |
| Module-level constant, Enum value | `CONSTANT_CASE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Module alias | `lowerCamelCase` | `import * as httpClient from '...'` |

**Rules:**

- Identifiers: ASCII letters, digits, underscores only in constants/test names; rare `$` (only when required by framework).
- No `_` prefix/suffix for private members; TypeScript `private` handles visibility.
- No `I` prefix for interfaces (`UserService` not `IUserService`).
- No `opt_` prefix for optional parameters.
- **Treat acronyms as words**: `loadHttpUrl` not `loadHTTPURL`; `xmlParser` not `XMLParser`. Exception: platform APIs that define their own casing (`XMLHttpRequest`).
- **Local constants**: `lowerCamelCase`, not `CONSTANT_CASE` (only module-level constants use `CONSTANT_CASE`).

```typescript
// ✅
const MAX_CONNECTIONS = 10;           // module-level constant
const defaultTimeout = 5000;         // local constant — lowerCamelCase

class HttpClient { ... }              // acronym treated as word
function loadHttpUrl(url: string) {}  // acronym treated as word

interface UserRepository { ... }      // no I prefix
function greet(name?: string) {}      // no opt_ prefix

// ❌
const max_connections = 10;          // no underscore in const
const DEFAULT_TIMEOUT = 5000;        // local const — use lowerCamelCase
class HTTPClient { ... }             // acronym not treated as word
interface IUserRepository { ... }    // no I prefix
function greet(opt_name?: string) {} // no opt_ prefix
```

---

## Comments & JSDoc

- `/** */` JSDoc for all public API symbols (classes, interfaces, functions, enums, properties).
- `/** @fileoverview ... */` for file-level documentation.
- `@param` and `@return` only when they add information not in the type signature.
- `//` for implementation notes; `/* */` is not used for JSDoc-style comments.
- Comment *why*, not *what* — code should be self-documenting for the "what".

```typescript
// ✅ JSDoc on public API
/**
 * Fetches a user by ID, returning null if not found.
 *
 * Retries up to MAX_RETRIES times on transient network errors.
 */
export async function getUser(id: string): Promise<User | null> {
  ...
}

// ✅ @param/@return only when non-obvious
/**
 * Formats a date for display.
 * @param date - UTC timestamp in milliseconds (not seconds).
 * @returns Locale-formatted string using the user's timezone.
 */
export function formatDate(date: number): string { ... }

// ✅ Implementation note: why, not what
// Normalize to empty array because the legacy API returns null for no results.
const items = response.items ?? [];

// ❌ Redundant JSDoc — type already captures this
/**
 * @param id The user ID (string)
 * @returns The user (User)
 */
function getUser(id: string): User { ... }

// ❌ Comment explaining what
// Increment count
count++;
```

---

## Formatting

Formatting is enforced by **Prettier** (and optionally clang-format). Do not hand-format code that tools will reformat.

| Rule | Value |
|---|---|
| Indentation | 2 spaces; no tabs |
| Quotes | Single `'`; template literals for interpolation/multiline |
| Semicolons | Required at end of statements (no ASI reliance) |
| Line length | 80-column soft limit |
| Trailing commas | In multi-line arrays, objects, and parameter lists |
| Blank lines in blocks | None at start/end of blocks |

```typescript
// ✅ Formatting examples
const config = {
  host: 'localhost',
  port: 8080,
  timeout: 5000,     // trailing comma
};

const message = `Hello, ${user.name}!`;  // template literal for interpolation
const multiline = `
  This is a
  multiline string
`;

// ❌
const config = {
	host: "localhost",    // tabs, double quotes
	port: 8080
}                         // missing trailing comma, missing semicolon
```

---

## Disallowed Features

Hard bans — **never use these:**

| Feature | Reason / Alternative |
|---|---|
| `var` declarations | Use `const` or `let` |
| `new Array()` | Use `[]` literal |
| `new Object()` | Use `{}` literal |
| `#private` fields | Use TypeScript `private` keyword |
| Default exports | Use named exports |
| `export let` | Use `export const` |
| `with` statement | Deprecated; confusing scoping |
| `eval` / `Function(...string)` | Security risk; no dynamic code execution |
| `const enum` | Inlining breaks module boundaries |
| Wrapper objects (`new String()`, etc.) | Use primitives |
| `debugger` in production | Remove before committing |
| Non-standard ECMAScript features | Stick to the TS/ES standard |
| Prototype modification | Fragile; breaks encapsulation |
| `parseInt` / `parseFloat` without validation | Use `Number()` + `isNaN()` |
| Unary `+` for coercion | Use `Number()` explicitly |
| `!!` coercion of enum values | Use explicit comparison |
| `for...in` on arrays | Use `for...of` |
| `any` (except necessary interop) | Use `unknown` and narrow |
| `object` type | Use `{}`, specific type, or `Record` |
| `I` prefix on interfaces | Plain `UpperCamelCase` |
| `_` prefix/suffix for private | Use `private` keyword |

```typescript
// ❌ All of these are banned

var x = 1;
const arr = new Array(3);
const obj = new Object();
class Foo { #secret = 1; }
export default class Foo {}
export let mutableValue = 0;
with (obj) { name = 'foo'; }
eval('doSomething()');
const E = new Function('return 1');
const enum Color { Red }
const s = new String('hello');
debugger;
Object.prototype.custom = () => {};
const n = parseInt('42');           // missing radix check
const n = +'42';                    // use Number('42')
if (!!enumValue) {}                 // use enumValue !== 0
for (const k in arr) {}             // use for...of
function f(x: any) {}               // use unknown
function f(x: object) {}            // use {} or Record
interface IFoo {}                   // no I prefix
class Service { _data = []; }       // use private
```

---

## Decorators

- Only use framework-provided decorators (e.g., Angular `@Component`, Polymer `@property`).
- **Do not define new decorators** in application code — the decorator proposal has been unstable.

```typescript
// ✅ Framework decorator — acceptable
@Component({selector: 'app-root', template: '<h1>Hello</h1>'})
class AppComponent {}

// ❌ Custom application decorator
function log(target: any, key: string, descriptor: PropertyDescriptor) { ... }
```

---

## Skill Loading Triggers

| Situation | Load skills |
|---|---|
| Writing any TypeScript code | `standards-typescript` + `standards-code` |
| TypeScript API / module design | `standards-typescript` + `role-architect` |
| Writing TypeScript tests | `standards-typescript` + `standards-testing` |
| Auth, secrets, user input handling | `standards-security` |
| Implementing features/fixes (TDD) | `role-developer` |
| TS PR review | `role-code-review` |

## Verification Checklist

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `tsconfig` has `strict: true` (implies `noImplicitAny`, `strictNullChecks`)
- [ ] `npx eslint --ext .ts .` passes
- [ ] `npx prettier --check .` passes
- [ ] No `var` declarations anywhere
- [ ] No `any` types (use `unknown` and narrow)
- [ ] No default exports; all exports are named
- [ ] No `export let` (only `export const`)
- [ ] No `#private` fields (use TypeScript `private`)
- [ ] No `const enum` (use plain `enum`)
- [ ] No wrapper object instantiation (`new String()`, etc.)
- [ ] No `eval` or `Function(...string)` constructor
- [ ] `import type {Foo}` used for type-only imports
- [ ] All public API symbols have JSDoc `/** */` comments
- [ ] Error handling uses `catch (e: unknown)` with `instanceof Error` narrowing
- [ ] `throw new Error(...)` — no throwing strings or plain objects
- [ ] Type assertions use `as Foo` not `<Foo>`
- [ ] Double assertions use `unknown` as intermediate, not `any`
- [ ] Acronyms treated as words in identifiers (`httpUrl` not `HTTPUrl`)
- [ ] No `I` prefix on interfaces
- [ ] No `_` prefix/suffix for private members
- [ ] `CONSTANT_CASE` only for module-level constants; local constants use `lowerCamelCase`
- [ ] `for...of` used to iterate arrays (not `for...in` or index loop)
- [ ] `Object.entries()`/`Object.keys()`/`Object.values()` used instead of `for...in` on objects
- [ ] `interface` used for structural types; `class` not used for pure data shapes
- [ ] Optional `?` preferred over explicit `|undefined` for params/fields
- [ ] No `debugger` statements in committed code
