---
name: role-architect
description: MUST load for system design or architectural decisions; SHOULD load for scalability analysis or large refactoring. Applies SOLID principles and design patterns.
license: MIT
compatibility: opencode
metadata:
  role: architect
  focus: structure
---

**Provides:** SOLID principles, design patterns, architectural trade-off analysis, and scalability evaluation.

## Quick Reference

**Core Principles**: SOLID, DRY, KISS, YAGNI, Separation of Concerns

**Common Patterns**: MVC, Repository, Factory, Strategy, Observer, Dependency Injection

**Design Considerations**: Scalability, Maintainability, Performance, Security, Testability

**Reference**: `standards-code`, `standards-security`, `standards-testing` skills

---

## Architectural Principles

### SOLID Principles

**S - Single Responsibility**: Each module/class should have one reason to change
- One responsibility per component
- Clear, focused purpose
- Easy to understand and test

**O - Open/Closed**: Open for extension, closed for modification
- Add features by extending, not modifying
- Use interfaces and abstraction
- Plugins and middleware patterns

**L - Liskov Substitution**: Subtypes must be substitutable for their base types
- Child classes honor parent contracts
- Don't break expected behavior
- Proper inheritance hierarchies

**I - Interface Segregation**: Many specific interfaces > one general interface
- Clients shouldn't depend on unused methods
- Keep interfaces focused
- Split large interfaces

**D - Dependency Inversion**: Depend on abstractions, not concretions
- High-level modules don't depend on low-level modules
- Both depend on abstractions
- Use dependency injection

### Other Core Principles

**DRY (Don't Repeat Yourself)**: Avoid code duplication
- Extract common logic
- Create reusable components
- Single source of truth

**KISS (Keep It Simple, Stupid)**: Simplicity over complexity
- Simplest solution that works
- Avoid premature optimization
- Clear and straightforward code

**YAGNI (You Aren't Gonna Need It)**: Don't build what you don't need yet
- Implement when actually needed
- Avoid speculative features
- Focus on current requirements

**Separation of Concerns**: Divide system into distinct features with minimal overlap
- Each part handles one concern
- Clear boundaries between components
- Loose coupling, high cohesion

---

## Common Design Patterns

### Creational Patterns

**Factory**: Create objects without specifying exact class
- Centralizes object creation
- Easy to change implementation
- Good for complex initialization

**Singleton**: Ensure class has only one instance
- Use sparingly (often anti-pattern)
- Consider dependency injection instead
- Good for: config, logging, connection pools

**Builder**: Construct complex objects step by step
- Fluent API for configuration
- Handles optional parameters well
- Good for objects with many fields

### Structural Patterns

**Adapter**: Convert interface of class into another interface
- Integrate incompatible interfaces
- Wrap third-party libraries
- Make old code work with new code

**Decorator**: Add behavior to objects dynamically
- Extend functionality without subclassing
- Chain multiple decorators
- Good for: middleware, logging, validation

**Repository**: Separate domain logic from data access
- Centralize data access logic
- Easy to test (mock repository)
- Clean separation of concerns

### Behavioral Patterns

**Strategy**: Define family of algorithms, make them interchangeable
- Select algorithm at runtime
- Eliminate conditional logic
- Good for: payment methods, sort algorithms

**Observer**: Define one-to-many dependency (publish-subscribe)
- Decouple publishers from subscribers
- Event-driven architecture
- Good for: notifications, reactive systems

**Command**: Encapsulate request as object
- Queue, log, or undo operations
- Decouple sender from receiver
- Good for: undo/redo, job queues

---

## System Architecture Patterns

### Layered Architecture (N-Tier)

**Structure:**
```
Presentation Layer (UI)
    ↓
Business Logic Layer (Services)
    ↓
Data Access Layer (Repository)
    ↓
Database
```

**When to use:** Traditional applications, clear separation of concerns
**Pros:** Simple, familiar, organized
**Cons:** Can become rigid, tight coupling between layers

### MVC (Model-View-Controller)

**Structure:**
- **Model**: Data and business logic
- **View**: Presentation layer
- **Controller**: Handles requests, coordinates model and view

**When to use:** Web applications, user-facing systems
**Pros:** Separation of concerns, testable, parallel development
**Cons:** Can be overkill for simple apps

### Microservices

**Structure:** Independent, loosely coupled services
- Each service owns its data
- Communicate via APIs
- Deployed independently

**When to use:** Large systems, multiple teams, need for independent scaling
**Pros:** Scalability, flexibility, technology diversity
**Cons:** Complexity, distributed system challenges, operational overhead

### Event-Driven

**Structure:** Components communicate via events
- Producers emit events
- Consumers react to events
- Asynchronous processing

**When to use:** Reactive systems, real-time processing, complex workflows
**Pros:** Loose coupling, scalability, flexibility
**Cons:** Complexity, debugging challenges, eventual consistency

---

## Design Trade-offs

### Performance vs Maintainability
**Performance optimization often adds complexity**
- Start with clear, maintainable code
- Optimize only when necessary (measure first)
- Document performance-critical sections

### Flexibility vs Simplicity
**More flexible systems are often more complex**
- YAGNI: Don't add flexibility you don't need yet
- Balance: Simple now, easy to extend later
- Use abstractions where extension is likely

### Consistency vs Autonomy (Microservices)
**Standardization vs team independence**
- Shared standards for cross-cutting concerns
- Autonomy for service internals
- Balance governance with agility

### Strong Typing vs Rapid Development
**Type safety vs development speed**
- Types catch errors early
- Can slow initial development
- TypeScript, type hints provide middle ground

---

## Scalability Considerations

### Horizontal vs Vertical Scaling

**Vertical (Scale Up):** Add more power to existing machine
- Simpler to implement
- Has physical limits
- Single point of failure

**Horizontal (Scale Out):** Add more machines
- No practical limit
- Requires distributed system design
- More complex but more resilient

### Stateless Design
- Store state externally (database, cache, session store)
- Enables easy horizontal scaling
- Any instance can handle any request

### Caching Strategies
- Cache expensive operations
- Use CDN for static assets
- Implement cache invalidation strategy
- Consider Redis, Memcached

### Database Scaling
- Read replicas for read-heavy workloads
- Sharding for write-heavy workloads
- Consider NoSQL for specific use cases
- Connection pooling

---

## Architecture Decision Process

### 1. Understand Requirements
- [ ] Functional requirements clear
- [ ] Non-functional requirements identified (performance, security, scalability)
- [ ] Constraints understood (budget, time, technology)

### 2. Identify Options
- [ ] Research potential approaches
- [ ] List viable architectures/patterns
- [ ] Consider existing solutions and frameworks

### 3. Evaluate Trade-offs
- [ ] Performance implications
- [ ] Development complexity
- [ ] Operational complexity
- [ ] Cost (development and operational)
- [ ] Scalability potential
- [ ] Maintainability
- [ ] Team expertise

### 4. Make Decision
- [ ] Choose approach that best fits requirements
- [ ] Document decision and rationale
- [ ] Consider reversibility (can we change later?)

### 5. Document Decision in Store-Memory (Recommended)

**For architectural decisions that should survive sessions and be discoverable long-term:**

**Load tool-store skill for ADR documentation patterns:**
```
skill(name: "tool-store")
```

**When to persist architectural decisions:**
- [ ] Decision has long-term impact on system design
- [ ] Future engineers need to understand rationale
- [ ] Decision affects multiple features or teams
- [ ] Want to avoid re-litigating solved problems
- [ ] Need to reference from implementation TODOs

**The tool-store skill provides:**
- ADR (Architecture Decision Record) structure and examples
- How to document context, decision, rationale, alternatives, and consequences
- Tagging strategies for discoverability (`"adr"`, `"architecture"`, `"decision"`)
- TODO-Store linking pattern (`[store:id]` syntax for referencing in work items)

**Benefits:**
- Decisions survive beyond implementation
- Searchable via tags: `storeread({ tags: ["adr", "database"] })`
- Can be linked from TODO items for full context
- Creates institutional knowledge base

### 6. Validate
- [ ] Prototype critical components
- [ ] Stress test assumptions
- [ ] Get feedback from team

---

## Common Anti-Patterns to Avoid

**Big Ball of Mud**: Haphazard structure, no clear architecture
- Solution: Define clear boundaries and layers

**God Object/Class**: One class that does everything
- Solution: Apply Single Responsibility Principle

**Spaghetti Code**: Tangled control flow, no structure
- Solution: Refactor into modules with clear interfaces

**Golden Hammer**: Using same solution for every problem
- Solution: Evaluate each problem independently

**Premature Optimization**: Optimizing before measuring
- Solution: Make it work, make it right, then make it fast

**Over-Engineering**: Adding complexity for potential future needs
- Solution: YAGNI - build what's needed now

---

## Architecture Documentation

### What to Document

**System Context**: How system fits in larger environment
- External dependencies
- Users and their needs
- Integration points

**Component Structure**: Main building blocks
- Component responsibilities
- Interfaces between components
- Data flow

**Key Decisions**: Important architectural choices
- What was decided
- Why it was decided
- Alternatives considered
- Trade-offs made

**Non-Functional Requirements**: Quality attributes
- Performance targets
- Security requirements
- Scalability needs
- Availability expectations

### Documentation Format

**Use diagrams:**
- System context diagram
- Component diagram
- Sequence diagrams for key flows
- Deployment diagram

**Keep it concise:**
- Focus on "why" not just "what"
- Update when architecture changes
- Store with code (markdown in repo)

---

## Checklist for Architectural Review

### Structure
- [ ] Clear separation of concerns
- [ ] Appropriate layering or service boundaries
- [ ] Components have single, clear responsibilities
- [ ] Dependencies point in correct direction (high-level → abstractions)

### Scalability
- [ ] Can scale horizontally if needed
- [ ] Stateless design where appropriate
- [ ] Caching strategy defined
- [ ] Database scaling considered

### Maintainability
- [ ] Code is modular and reusable
- [ ] Clear interfaces between components
- [ ] Easy to test (mockable dependencies)
- [ ] Follows established patterns

### Performance
- [ ] Performance requirements identified
- [ ] Critical paths optimized
- [ ] Appropriate use of async/parallel processing
- [ ] Resource usage considered

### Security
- [ ] Security by design (not bolted on)
- [ ] Least privilege principle
- [ ] Attack surface minimized
- [ ] Security boundaries clear

### Testability
- [ ] Components can be tested in isolation
- [ ] Dependencies can be mocked
- [ ] Integration points testable
- [ ] Test strategy defined

---

## Integration with Other Skills

**With pattern-task-breakdown**: Use architecture to inform task breakdown
**With role-code-review**: Review code against architectural principles
**With role-security-auditor**: Ensure architecture supports security requirements

---

## Quick Tips

- **Start simple, evolve** - Don't over-engineer upfront
- **Design for testability** - Makes everything easier
- **Document decisions** - Future you will thank you
- **Consider Conway's Law** - System structure mirrors team structure
- **Measure don't guess** - Profile before optimizing
- **Embrace change** - Architecture should evolve with understanding
