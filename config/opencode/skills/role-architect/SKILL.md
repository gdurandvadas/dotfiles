---
name: role-architect
description: Load for system design or architectural decisions. Applies SOLID principles, design patterns, and trade-off analysis.
license: MIT
compatibility: opencode
metadata:
  role: architect
  focus: structure
---

**Provides:** Architectural principles, design pattern selection, trade-off analysis, and decision documentation.

## Core Principles

- **Single Responsibility:** Each module/class has one reason to change
- **Open/Closed:** Open for extension, closed for modification
- **Liskov Substitution:** Subtypes must be substitutable for base types
- **Interface Segregation:** Many specific interfaces > one general interface
- **Dependency Inversion:** Depend on abstractions, not concretions
- **DRY:** Extract common logic, single source of truth
- **KISS:** Simplest solution that works
- **YAGNI:** Don't build what you don't need yet

## Design Patterns Reference

**Creational:** Factory (centralize creation), Builder (complex objects step-by-step), Singleton (use sparingly, prefer DI)

**Structural:** Adapter (integrate incompatible interfaces), Decorator (extend behavior dynamically), Repository (separate domain from data access)

**Behavioral:** Strategy (interchangeable algorithms), Observer (publish-subscribe), Command (encapsulate request as object)

## Architecture Patterns

| Pattern | When to Use | Trade-offs |
|---------|------------|------------|
| Layered (N-Tier) | Traditional apps, clear separation | Simple but can become rigid |
| MVC | Web applications | Testable but overkill for simple apps |
| Microservices | Large systems, multiple teams | Scalable but complex operations |
| Event-Driven | Reactive, real-time, complex workflows | Loose coupling but debugging is harder |

## Decision Process

1. Understand requirements (functional + non-functional)
2. Identify viable approaches
3. Evaluate trade-offs (performance, complexity, cost, scalability, maintainability, team expertise)
4. Choose approach, document decision and rationale
5. Validate with prototypes for critical components

Use `tool-store` skill to persist important architectural decisions with rationale for cross-session reference.

## Common Anti-Patterns

- **Big Ball of Mud:** No clear architecture -> define boundaries and layers
- **God Object:** One class does everything -> apply Single Responsibility
- **Golden Hammer:** Same solution for every problem -> evaluate independently
- **Premature Optimization:** Optimizing before measuring -> make it work, then make it fast
- **Over-Engineering:** Building for hypothetical future -> YAGNI

## Review Checklist

- [ ] Clear separation of concerns with appropriate boundaries
- [ ] Dependencies point in correct direction (high-level -> abstractions)
- [ ] Can scale horizontally if needed
- [ ] Components testable in isolation with mockable dependencies
- [ ] Security by design, least privilege, attack surface minimized
- [ ] Performance requirements identified, critical paths considered
