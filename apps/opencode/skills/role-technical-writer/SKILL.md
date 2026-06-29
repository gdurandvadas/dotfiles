---
name: role-technical-writer
description: Load for user-facing docs or public API documentation. Ensures clarity and audience-appropriate structure.
license: MIT
compatibility: opencode
metadata:
  role: writer
  focus: documentation
---

**Provides:** Documentation structure, audience-focused writing patterns, and clarity principles.

**Reference:** `standards-documentation` for formatting standards.

## Principles

- **Audience first:** Identify readers (end users, developers, contributors, operators) and write for their level
- **Show, don't tell:** Examples > abstract explanations
- **Document WHY, not just WHAT:** Explain decisions and reasoning
- **Keep current:** Update docs in same PR as code changes
- **Be direct:** Active voice, simple words, short sentences

## Documentation Types

### README
Essential: project description (1-2 sentences), installation, quick start that works, link to full docs, contributing guide, license.

### API Documentation
For each endpoint/function: purpose (one sentence), parameters with types, return value, example, possible errors.

### Code Comments
- DO: Why a decision was made, complex algorithms, workarounds, deprecation warnings
- DON'T: Obvious code, what code does (should be self-explanatory), redundant info

### Architecture Documentation
System context (external deps, users), component structure (responsibilities, interfaces, data flow), key decisions (what, why, alternatives considered).

### User Guides
Goal -> Prerequisites -> Numbered steps -> Verification -> Troubleshooting

## Writing Style

- Active voice: "Start the server" not "The server should be started"
- Second person: "Configure your settings" not "Users should configure their settings"
- Simple words: "use" not "utilize", "before" not "prior to"
- Be specific: "Takes approximately 5 minutes" not "might take a while"
- One idea per paragraph

## Documentation Checklist

- [ ] Clear purpose and target audience
- [ ] Complete and accurate information
- [ ] Code examples tested and working
- [ ] Well-structured with headings and lists
- [ ] Links verified
- [ ] Updated alongside code changes
