---
name: standards-markdown
description: MUST load when writing or reviewing Markdown files; SHOULD load for docs, READMEs, or content reviews. Provides Google style guide rules, formatting checklists, and common pitfall guidance.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: markdown
---

# Markdown Standards

**Provides:** Google Markdown style checks, prose layout cues, and lightweight review guardrails.

## Quick Reference

- Start every file with a single H1 that matches the filename and follow with a 1–3 sentence intro.
- If hosting supports it, drop a `[TOC]` right after the intro before the first H2.
- Keep heading hierarchy as H1 → H2 → H3+ and use sentence case with descriptive labels.
- Cap prose lines at 80 characters unless a link, code, table, or heading forces a longer line.
- Avoid trailing whitespace and use `\` sparingly for intentional breaks.
- Prefer lazy numbering (`1.`) for long lists; indent nested items by four spaces.
- Use backticks for inline code, escape Markdowny text, and wrap blocks in fenced code with language tags.
- Reference links for long URLs and tables; keep internal links explicit (no `../`).
- Describe links with meaningful titles; never label “see here” or paste the raw URL as the text.
- Use alt text for images and add them only when they add value, ideally as screenshots.
- Tables belong to tabular data only; fall back to lists plus subheadings if the content is prose-heavy.
- Prefer Markdown over HTML; skip HTML tricks that hinder portability.
- Document the minimum viable content, then iterate—better beats perfect.
- End with a `## See also` section for related references and resources.

---

## Document layout

- **H1 first**: Use a single `# Title` that matches the filename (e.g., `# CONTRIBUTING`).
- **Intro**: Follow the H1 with 1–3 sentences summarizing scope or purpose.
- **TOC**: Insert `[TOC]` after the intro if the platform renders it before the first H2.
- **Headings**: Every other section starts at `##`. Keep heading names unique and descriptive.
- **See also**: Reserve `## See also` for supplemental links at the bottom of the file.

```markdown
# Markdown Guide

This file captures the preferred heading, list, and code styles.

[TOC]

## Document layout
...

## See also
- [standards-documentation](../standards-documentation/SKILL.md)
```

## Character limits & whitespace

- **Prose limit**: Wrap sentences at ~80 characters to aid reviewers and diffs.
- **Exceptions**: Links, tables, headings, and code blocks may extend beyond 80 chars.
- **Trailing whitespace**: Never leave trailing spaces; they break Markdown and diff cleanliness.
- **Intentional breaks**: Use a single trailing backslash `\` where a literal line break is required (sparingly).

```markdown
This sentence is short.
This second sentence stays under eighty characters.
This sentence contains an inline note that references `some/path` without wrapping.

Line one with\
an intentional break.
```

## Headings

- **ATX only**: Always use `#` through `######`; never underline with `===` or `---`.
- **Spacing**: Add a blank line before and after each heading and a single space after the `#` characters.
- **Sentence case**: Treat headings like sentences—capitalize only the first word and proper nouns unless a stylized acronym is needed.
- **Uniqueness**: Skip generic duplicates such as `### Summary` in multiple sections; prefer `### API summary` versus `### UI summary`.

```markdown
## Heading sentence style

## API summary

## UI summary
```

## Lists

- For lists that may change, prefer **lazy numbering** (every item starts with `1.`) so adding/removing entries stays clean.
- Use explicit numbers for short, stable sequences (e.g., `1. Download`, `2. Install`).
- Nest lists by indenting four spaces (two spaces after the number, three after the bullet, totaling four characters of indent).
- Single-line bullets or numbered lists can use a single space indent if they remain flat.

```markdown
1. First step (lazy numbered list).
1. Next step without renumbering.
   1. Nested detail (indented by four spaces).

- Flat bullet
- Another flat bullet
```

## Code

- Surround inline code, commands, field names, and file paths with backticks.
- Escape Markdown-like content inside text using backticks when it might be parsed (e.g., `<<EOF`).
- Use fenced code blocks (```` ``` ````) for multi-line examples; specify the language immediately after the opening fence.
- Escape shell snippets with `\` when breaking commands over lines.
- If code sits inside a list, indent the fence so Markdown remains valid (each fence line indented four spaces inside list items).

```markdown
```bash
npm install --save @scope/pkg \
  --force
```

1. Run the build

    ```bash
    npm run build
    ```
```

## Links

- Prefer **reference-style links** for long URLs or when reusing the same link in multiple spots.
- Keep internal links explicit (no `../` jumps across directories unless unavoidable).
- Write descriptive link titles—avoid generic text like “click here” or raw URLs as link text.
- Place reference definitions either at the end of the current section or at the document’s end if shared across sections.
- Use reference links within tables to keep cells tidy.

```markdown
See the [style guide][style] for details.

[style]: https://google.github.io/styleguide/docguide/style.html
```

## Images

- Use images sparingly—only when they add value that prose cannot capture, such as annotated screenshots or diagrams.
- Always supply meaningful alt text that describes the image’s purpose.
- Prefer hosted images that remain stable; avoid broken links or temporary attachments.

```markdown
![Screenshot showing the Markdown editor toolbar](assets/editor-toolbar.png)
```

## Tables

- Limit tables to truly tabular data (parallel items with consistent columns).
- For prose-heavy content, prefer hierarchical headings and bullet lists to maintain readability.
- Use reference links within table cells to keep rows short and readable.

```markdown
| Field | Description |
| --- | --- |
| Title | Reference the main heading ([title][title-link]). |
| Layout | Intro, [TOC], then sections. |

[title-link]: https://example.com/docs/layout
```

## HTML

- Stick to Markdown syntax; HTML hacks reduce portability and often introduce validation issues.
- Only use raw HTML when Markdown cannot express the desired layout (rare). In such cases, document why it is necessary.

## Philosophy

- **Minimum viable docs**: Small, accurate documentation trumps sprawling but stale prose.
- **Better/Best Rule**: Fast iterations beat perfection. Reviewers should not block progress on minor style nits—mentor authors to fix them instead.
- Prioritize clarity over clever formatting; consistent patterns make future updates easier.

## Checklist

- [ ] Does the file start with a single H1 that matches the filename and include a brief intro?
- [ ] Is the rest of the document built with ATX headings that follow sentence case and avoid generic duplicates?
- [ ] Are prose lines wrapped near 80 characters with no trailing whitespace or stray line breaks?
- [ ] Do lists use lazy numbering when they may change and proper indentation for nested items?
- [ ] Are code snippets fenced with language tags and properly indented inside lists?
- [ ] Are links descriptive, using reference style definitions where helpful, and pointing to explicit paths?
- [ ] Have images been limited to high-value visuals with descriptive alt text?
- [ ] Are tables reserved for structured data, and do they use reference links to keep rows compact?
- [ ] Is Markdown preferred over HTML, and are any HTML blocks justified and documented?
- [ ] Does the bottom include a `## See also` section for related references?
