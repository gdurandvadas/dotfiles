---
name: standards-svelte
description: MUST load when writing or reviewing Svelte components; SHOULD load for Svelte project architecture decisions. Provides runes-mode patterns, reactivity, event handling, styling, and modern Svelte 5 best practices.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: svelte
  priority: high
---

# Svelte Standards

**Provides:** Modern Svelte 5 runes-mode patterns, reactivity (`$state`, `$derived`, `$effect`), event handling, snippets, styling, context, and a complete legacy-feature avoidance reference.

**Primary references:**

- [Svelte Documentation](https://svelte.dev/docs)
- [Svelte Tutorial](https://svelte.dev/tutorial)
- [Svelte Blog](https://svelte.dev/blog)

## Quick Reference

**Golden Rule**: Use runes mode for all new code; avoid `$effect` when `$derived` or event handlers suffice.

**Style principles (priority order):**

| Principle   | Key question                              |
| ----------- | ----------------------------------------- |
| Reactivity  | Is this the minimal reactive surface?     |
| Clarity     | Can a reader follow the data flow?        |
| Performance | Are unnecessary re-renders avoided?       |
| Simplicity  | Is this the simplest approach that works? |
| Consistency | Does this match modern Svelte 5 patterns? |

**Do** (✅):

- `$state` only for reactive variables that drive UI updates
- `$state.raw` for large objects that are reassigned, not mutated (e.g., API responses)
- `$derived` for computed values (not `$effect`)
- `$derived.by` for complex derived expressions
- `$props` with `$derived` for prop-dependent values
- `onclick={...}` for event handling (not `on:click`)
- `{#snippet ...}` and `{@render ...}` for reusable markup
- `{@attach ...}` for DOM element side effects
- Keyed `{#each}` blocks with unique identifiers
- CSS custom properties (`--var`) for parent-child styling
- `createContext` for scoped shared state
- `$inspect.trace` for debugging reactivity

**Don't** (❌):

- Update state inside `$effect` — use `$derived` instead
- Wrap effect contents in `if (browser)` — effects don't run on the server
- Use index as key in `{#each}` blocks
- Use legacy features: `$:`, `export let`, `on:click`, `<slot>`, `use:action`, `class:`, `<svelte:component>`, `<svelte:self>`, stores
- Use `onMount` or `$effect` for window/document event listeners
- Destructure `{#each}` items when you need to mutate them

---

## Reactivity

### `$state`

Only use `$state` for variables that should be _reactive_ — variables that cause an `$effect`, `$derived` or template expression to update. Everything else can be a normal variable.

Objects and arrays (`$state({...})` or `$state([...])`) are made deeply reactive, meaning mutation will trigger updates. This has a trade-off: in exchange for fine-grained reactivity, the objects must be proxied, which has performance overhead. In cases where you're dealing with large objects that are only ever reassigned (rather than mutated), use `$state.raw` instead. This is often the case with API responses, for example.

### `$derived`

To compute something from state, use `$derived` rather than `$effect`:

```js
// ✅ do this
let square = $derived(num * num);

// ❌ don't do this
let square;

$effect(() => {
  square = num * num;
});
```

> [!NOTE] `$derived` is given an expression, _not_ a function. If you need to use a function (because the expression is complex, for example) use `$derived.by`.

Deriveds are writable — you can assign to them, just like `$state`, except that they will re-evaluate when their expression changes.

If the derived expression is an object or array, it will be returned as-is — it is _not_ made deeply reactive. You can, however, use `$state` inside `$derived.by` in the rare cases that you need this.

### `$effect`

Effects are an escape hatch and should mostly be avoided. In particular, avoid updating state inside effects.

- If you need to sync state to an external library such as D3, it is often neater to use `{@attach ...}`
- If you need to run some code in response to user interaction, put the code directly in an event handler or use a function binding as appropriate
- If you need to log values for debugging purposes, use `$inspect`
- If you need to observe something external to Svelte, use `createSubscriber`

Never wrap the contents of an effect in `if (browser) {...}` or similar — effects do not run on the server.

### `$props`

Treat props as though they will change. Values that depend on props should usually use `$derived`:

```js
let { type } = $props();

// ✅ do this
let color = $derived(type === "danger" ? "red" : "green");

// ❌ don't do this — `color` will not update if `type` changes
let color = type === "danger" ? "red" : "green";
```

### `$inspect.trace`

`$inspect.trace` is a debugging tool for reactivity. If something is not updating properly or running more than it should you can add `$inspect.trace(label)` as the first line of an `$effect` or `$derived.by` (or any function they call) to trace their dependencies and discover which one triggered an update.

---

## Events

Any element attribute starting with `on` is treated as an event listener:

```svelte
<button onclick={() => {...}}>click me</button>

<!-- attribute shorthand also works -->
<button {onclick}>...</button>

<!-- so do spread attributes -->
<button {...props}>...</button>
```

If you need to attach listeners to `window` or `document` you can use `<svelte:window>` and `<svelte:document>`:

```svelte
<svelte:window onkeydown={...} />
<svelte:document onvisibilitychange={...} />
```

Avoid using `onMount` or `$effect` for this.

---

## Snippets

Snippets are a way to define reusable chunks of markup that can be instantiated with the `{@render ...}` tag, or passed to components as props. They must be declared within the template.

```svelte
{#snippet greeting(name)}
	<p>hello {name}!</p>
{/snippet}

{@render greeting('world')}
```

> [!NOTE] Snippets declared at the top level of a component (i.e. not inside elements or blocks) can be referenced inside `<script>`. A snippet that doesn't reference component state is also available in a `<script module>`, in which case it can be exported for use by other components.

---

## Each Blocks

Prefer to use keyed each blocks — this improves performance by allowing Svelte to surgically insert or remove items rather than updating the DOM belonging to existing items.

> [!NOTE] The key _must_ uniquely identify the object. Do not use the index as a key.

Avoid destructuring if you need to mutate the item (with something like `bind:value={item.count}`, for example).

---

## Styling

### Using JavaScript Variables in CSS

If you have a JS variable that you want to use inside CSS you can set a CSS custom property with the `style:` directive.

```svelte
<div style:--columns={columns}>...</div>
```

You can then reference `var(--columns)` inside the component's `<style>`.

### Styling Child Components

The CSS in a component's `<style>` is scoped to that component. If a parent component needs to control the child's styles, the preferred way is to use CSS custom properties:

```svelte
<!-- Parent.svelte -->
<Child --color="red" />

<!-- Child.svelte -->
<h1>Hello</h1>

<style>
	h1 {
		color: var(--color);
	}
</style>
```

If this is impossible (for example, the child component comes from a library) you can use `:global` to override styles:

```svelte
<div>
	<Child />
</div>

<style>
	div :global {
		h1 {
			color: red;
		}
	}
</style>
```

---

## Context

Consider using context instead of declaring state in a shared module. This will scope the state to the part of the app that needs it, and eliminate the possibility of it leaking between users when server-side rendering.

Use `createContext` rather than `setContext` and `getContext`, as it provides type safety.

---

## Async Svelte

If using version 5.36 or higher, you can use await expressions and hydratable to use promises directly inside components. Note that these require the `experimental.async` option to be enabled in `svelte.config.js` as they are not yet considered fully stable.

---

## Avoid Legacy Features

Always use runes mode for new code, and avoid features that have more modern replacements:

| Legacy Feature                             | Modern Replacement                                       |
| ------------------------------------------ | -------------------------------------------------------- |
| `let count = 0` (implicit reactivity)      | `$state`                                                 |
| `$:` assignments and statements            | `$derived` and `$effect` (prefer `$derived`)             |
| `export let` / `$$props` / `$$restProps`   | `$props`                                                 |
| `on:click={...}`                           | `onclick={...}`                                          |
| `<slot>` / `$$slots` / `<svelte:fragment>` | `{#snippet ...}` and `{@render ...}`                     |
| `<svelte:component this={Cmp}>`            | `<DynamicComponent>`                                     |
| `<svelte:self>`                            | `import Self from './ThisComponent.svelte'` and `<Self>` |
| Stores (`writable`, `readable`, etc.)      | Classes with `$state` fields                             |
| `use:action`                               | `{@attach ...}`                                          |
| `class:active={isActive}`                  | clsx-style arrays and objects in `class` attributes      |

---

## Skill Loading Triggers

| Situation                             | Also load              |
| ------------------------------------- | ---------------------- |
| Writing any Svelte code               | `standards-code`       |
| Writing Svelte with TypeScript        | `standards-typescript` |
| Writing tests for Svelte components   | `standards-testing`    |
| Auth, secrets, user input handling    | `standards-security`   |
| Implementing features/fixes           | `role-developer`       |
| Svelte project/component architecture | `role-architect`       |
| Svelte PR review                      | `role-code-review`     |

## Verification Checklist

- [ ] All new code uses runes mode (`$state`, `$derived`, `$props`)
- [ ] No legacy `$:` reactive statements
- [ ] No `export let` — all props use `$props`
- [ ] No `on:click` — all events use `onclick` attribute syntax
- [ ] No `<slot>` — all content projection uses snippets and `{@render}`
- [ ] No `use:action` — DOM side effects use `{@attach ...}`
- [ ] No `class:` directive — class toggling uses clsx-style arrays/objects
- [ ] No stores — shared reactivity uses classes with `$state` fields
- [ ] `$effect` is not used where `$derived` would suffice
- [ ] No state updates inside `$effect` blocks
- [ ] `$state.raw` used for large reassigned-only objects (e.g., API responses)
- [ ] `{#each}` blocks use unique keys (not index)
- [ ] CSS custom properties used for parent-child styling (not `:global` when avoidable)
- [ ] `createContext` used instead of `setContext`/`getContext`
- [ ] No `onMount`/`$effect` for window/document event listeners — uses `<svelte:window>`/`<svelte:document>`
