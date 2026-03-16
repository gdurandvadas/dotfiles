---
name: pattern-orchestration-complex
description: MUST load for tasks affecting 4+ files or >60 min; DO NOT use for simple tasks. Executes 4-phase workflow (planning, execution, verification, cleanup).
license: MIT
compatibility: opencode
metadata:
  role: coordinator
  focus: complex-execution
---

**Provides:** 4-phase orchestration workflow (planning, execution, verification, cleanup) for complex multi-file tasks.

## Quick Reference

**4 Phases**: Planning → Execution → Verification → Cleanup

**Always get user approval** before starting execution

**One task at a time** - complete before moving to next

**Atomic commits** per task for rollback safety

---

## When to Use Complex Orchestration

### Indicators You Need This

**Size indicators:**

- [ ] 4+ files need modification or creation
- [ ] Estimated time > 60 minutes
- [ ] Multiple components affected
- [ ] Cross-cutting changes

**Complexity indicators:**

- [ ] Approach isn't immediately clear
- [ ] Multiple sequential steps required
- [ ] Dependencies between tasks
- [ ] Requires architectural decisions

**Risk indicators:**

- [ ] Security-critical changes
- [ ] Data migration involved
- [ ] Breaking changes to APIs
- [ ] Production system impact

**If 2+ indicators present → Use pattern-orchestration-complex**

### When NOT to Use

**Simple tasks:**

- 1-3 files, < 30 minutes
- Clear, straightforward approach
- Single delegation sufficient

**For simple tasks → Delegate directly, skip orchestration**

---

## Phase 1: Planning

### Step 1: Delegate to Thinker for Plan

**Create execution plan using pattern-task-breakdown skill:**

```
Task({
  subagent_type: "agent.think",
  description: "Create execution plan for complex task",
  prompt: `
Load skills: pattern-task-breakdown, role-architect

Task: Create execution plan for: {user's request}

Create a structured breakdown with:
- Phases (logical groupings of related work)
- Tasks per phase (1-2 hour chunks, clear and actionable)
- Dependencies (what must happen first)
- Risks (potential issues or blockers)
- Estimates (time for each phase)

Output as markdown following pattern-task-breakdown skill format.
  `
})
```

**Thinker will return structured plan with:**

- Overview of work
- Phases broken into tasks
- Dependencies mapped
- Time estimates
- Risk assessment

### Step 2: Present Plan to User

**Format the plan clearly:**

```markdown
## Execution Plan: {Feature Name}

**Summary**: {1-2 sentence overview of what will be built}

**Total Estimate**: {X} hours across {N} phases

---

### Phases

**Phase 1: {Phase Name}** ({time estimate})

- Task 1.1: {Description}
  - Files: {files to modify/create}
  - Dependencies: {none or task X}
- Task 1.2: {Description}
  - Files: {files}
  - Dependencies: {task 1.1}

**Phase 2: {Phase Name}** ({time estimate})

- Task 2.1: {Description}
  - Files: {files}
  - Dependencies: {Phase 1 complete}

**Phase 3: {Phase Name}** ({time estimate})

- Task 3.1: {Description}
  - Files: {files}
  - Dependencies: {Phase 2 complete}

---

### Dependencies

- {Critical dependency 1}
- {Critical dependency 2}

### Risks

- {Potential risk 1 and mitigation}
- {Potential risk 2 and mitigation}

---

**Proceed with this plan? (yes/no)**
```

### Step 3: Wait for User Approval

**DO NOT proceed without explicit user approval**

**User may:**

- Approve as-is → Proceed to execution
- Request modifications → Revise plan and re-present
- Change scope → Update plan
- Reject → Don't proceed

**Only continue after user says "yes" or "proceed" or "approved"**

### Step 4: Setup Session

**Once approved, create session for tracking:**

1. **Create session:**

   ```bash
   Session ID: {timestamp}-{random}
   Location: .opencode/sessions/{session-id}/
   ```

2. **Create context file:**

   ```markdown
   # Task Context: {Feature Name}

   Session ID: {session-id}
   Created: {timestamp}
   Status: in_progress

   ## Current Request

   {User's original request}

   ## Plan Approved

   {Link to or summary of approved plan}

   ## Requirements

   {All functional and non-functional requirements}

   ## Decisions Made

   {Architectural and technical decisions from planning}

   ## Files to Modify/Create

   {Complete list from all phases}

   ## Progress

   [ ] Phase 1: {name}
   [ ] Task 1.1: {description}
   [ ] Task 1.2: {description}
   [ ] Phase 2: {name}
   [ ] Task 2.1: {description}
   ```

**Session is now ready for execution**

### Step 5: Persist Plan to Store (Required for Complex Tasks)

**Load tool-store skill:**

```
skill(name: "tool-store")
```

**When to persist:**

- [ ] Feature will take >4 hours
- [ ] Architectural decisions made during planning
- [ ] Multiple phases or agents involved
- [ ] Want plan to survive session cleanup or compaction

**What to store — include `prompt_drafts` for compaction-safe execution:**

Since this is a complex task (3+ TODOs, >60 min), the stored plan **MUST** include `data.prompt_drafts` with:

- `universal_handoff_prompt`: a plain copy-paste message (e.g. `@orchestrate Load store: <id>\n\nTask: Execute the plan.`) for the user to resume execution — **not** a `Task({ ... })` wrapper, since `orchestrate` is a primary agent, not a `Task()` target
- `todo_tasks[]`: one entry per planned step, each with `todo_content` (for `todowrite`) and `task_block` (the full delegation `Task({ ... })` targeting agent.fast/agent.balanced/agent.deep/etc.)

This ensures that if context is compacted between planning and execution, the agent can load the store item and immediately start delegating using the stored prompts — no context reconstruction needed.

**See `tool-store` skill → "Plan Prompt Drafts" section** for the canonical schema and a complete working example.

**Benefits:**

- Plan and decisions survive session cleanup and compaction
- Prompt drafts are always available — no reconstruction from memory
- Can be referenced via `[store:id]` syntax in TODO items

---

## Phase 2: Execution

### Execute Task-by-Task

**For EACH task in the plan:**

#### 1. Delegate Task

**Select appropriate subagent:**

- agent.fast: Simple edits, documentation, tests
- agent.balanced: Standard multi-file work
- agent.deep: Complex logic, security-critical, cross-cutting changes

**Delegate with context:**

```
Task({
  subagent_type: "{agent.fast|agent.balanced|agent.deep}",
  description: "{5-10 word summary}",
  prompt: `
Load skills: {relevant domain skills/standards/patterns}

Task: {specific task from plan}

Requirements:
- {requirement 1 from plan}
- {requirement 2 from plan}

Success Criteria:
- {criterion 1 - must be verifiable}
- {criterion 2 - must be verifiable}
  `
})
```

#### 2. Quality Gate Review

**Check delegated work against success criteria:**

- [ ] All requirements met?
- [ ] All success criteria satisfied?
- [ ] Code follows standards?
- [ ] Tests included and passing?
- [ ] No obvious errors or security issues?
- [ ] Documentation updated if needed?

**If ALL checked → Proceed to next step**
**If ANY unchecked → Load pattern-retry skill and loop back**

#### 3. Loop Back if Quality Gate Fails

**If work doesn't meet criteria:**

1. Load pattern-retry skill
2. Follow 3-attempt graduated strategy:
   - Attempt 1: Enhanced guidance, same agent
   - Attempt 2: Escalate to more capable agent
   - Attempt 3+: Ask user for intervention

3. Update session context with retry attempts

**Don't proceed to next task until current task passes quality gate**

#### 4. Commit Work

**Create atomic commit for completed task:**

```bash
git add {files changed in this task}
git commit -m "{Clear commit message describing what was done}

- {Detail 1}
- {Detail 2}

Task {X.Y} from {feature name}"
```

**Why atomic commits:**

- Easy to rollback if needed
- Clear history of what changed when
- Bisect-friendly for debugging
- Each commit represents working state

### Phase Management

**Between phases:**

1. Review phase completion
2. Update session progress
3. Verify phase goals met
4. Brief user on progress (optional but recommended)

**Example update to user:**

```
Phase 1 complete: User model and database schema implemented
- Created user model with bcrypt password hashing
- Database migrations working
- Unit tests passing (95% coverage)

Starting Phase 2: Authentication endpoints
```

---

## Phase 3: Verification

### After All Tasks Complete

**Perform comprehensive verification:**

### Step 1: Delegate Final Verification

```
Task({
  subagent_type: "agent.fast",
  description: "Final verification of completed work",
  prompt: `
Load skills: role-code-review, role-qa-engineer

Task: Verify all work from {feature name} meets requirements

Review ALL files modified in this feature.

Verification Checklist:
- [ ] All requirements from original request met
- [ ] All acceptance criteria satisfied
- [ ] Code follows standards (`skill:standards-code`)
- [ ] Security best practices applied (`skill:standards-security`)
- [ ] Tests comprehensive and passing (`skill:standards-testing`)
- [ ] Documentation updated where needed
- [ ] No obvious bugs or issues

Success Criteria:
- ALL checklist items verified
- Report any issues found
- Confirm ready for deployment or flag concerns
  `
})
```

### Step 2: Review Verification Results

**If issues found:**

1. Prioritize by severity
2. For critical issues: Load pattern-retry and fix before proceeding
3. For minor issues: Document as follow-up tasks or fix immediately

**If all good:**

- Proceed to cleanup

**Don't skip this step - final verification catches:**

- Integration issues
- Inconsistencies across changes
- Missing edge cases
- Documentation gaps

---

## Phase 4: Cleanup

### Step 1: Run Final Tests

**Ensure everything works end-to-end:**

```bash
# Run full test suite
npm test  # or equivalent

# Run linter
npm run lint

# Build (if applicable)
npm run build
```

**All should pass before finalizing**

### Step 2: Final Commit (if needed)

**If any cleanup changes needed:**

```bash
git add .
git commit -m "Final cleanup for {feature name}

- Documentation updates
- Minor formatting fixes
- {any other cleanup}
"
```

### Step 3: Create Summary

**Document what was accomplished:**

```markdown
# Summary: {Feature Name}

**Session**: {session-id}
**Started**: {timestamp}
**Completed**: {timestamp}
**Duration**: {hours}

## What Was Built

{1-2 paragraph summary of implementation}

## Files Created/Modified

- {file 1} - {purpose}
- {file 2} - {purpose}
- ... ({N} files total)

## Key Decisions

- {Decision 1 and rationale}
- {Decision 2 and rationale}

## Testing

- Test coverage: {%}
- All tests passing: {yes/no}

## Known Limitations

- {Limitation 1 if any}
- {Limitation 2 if any}

## Follow-up Items

- [ ] {Future improvement 1}
- [ ] {Future improvement 2}

## Learnings

{Any insights or challenges encountered}
```

### Step 4: Cleanup Session

**Ask user before removing files:**

```
Task complete!

Summary of work:
- {Brief summary}
- {Key accomplishments}
```

---

## Best Practices

### Planning Phase

✅ Get detailed plan before starting
✅ Present plan to user for approval
✅ Wait for explicit approval
✅ Setup session with complete context

❌ Don't skip planning for "quick" implementation
❌ Don't assume plan is approved
❌ Don't start without session for complex work

### Execution Phase

✅ Execute one task at a time
✅ Quality gate after each task
✅ Retry with strategy if needed
✅ Atomic commits per task
✅ Update session after each task

❌ Don't jump ahead to later tasks
❌ Don't skip quality reviews
❌ Don't commit multiple tasks together
❌ Don't forget to update session state

### Verification Phase

✅ Comprehensive final review
✅ Load role-code-review + role-qa-engineer skills
✅ Verify all original requirements
✅ Fix issues before cleanup

❌ Don't skip final verification
❌ Don't overlook minor issues
❌ Don't assume "tests pass" means "done"

### Cleanup Phase

✅ Run all tests before finalizing
✅ Create summary of work
✅ Ask before deleting session
✅ Document follow-up items

❌ Don't leave broken tests
❌ Don't skip documentation
❌ Don't delete session without asking

---

## Common Patterns

### Pattern 1: New Feature Implementation

```
1. Planning: Delegate to agent.think (pattern-task-breakdown + role-architect)
2. User Approval: Present plan, get explicit approval
3. Session Setup: Create with full context
4. Execution:
   - Phase 1: Data model + database
   - Phase 2: Business logic + services
   - Phase 3: API endpoints
   - Phase 4: Tests
5. Verification: Comprehensive review
6. Cleanup: Summary
```

### Pattern 2: Large Refactoring

```
1. Planning: Delegate to agent.think (pattern-task-breakdown + role-architect)
   - Include "add tests first" phase
   - Plan incremental changes
2. User Approval: Ensure plan is safe
3. Session Setup: Document current state
4. Execution:
   - Phase 1: Add tests for current behavior
   - Phase 2: Refactor section by section
   - Phase 3: Verify tests still pass
   - Phase 4: Clean up and optimize
5. Verification: Ensure no behavior changes
6. Cleanup: Document refactoring decisions
```

### Pattern 3: Security Hardening

```
1. Planning: Security audit first
   - Delegate to light + role-security-auditor
   - Identify all vulnerabilities
   - Prioritize by severity
2. User Approval: Review findings and plan
3. Session Setup: Track each vulnerability
4. Execution:
   - Fix critical issues (heavy + role-security-auditor)
   - Fix high-priority issues
   - Fix medium-priority issues
5. Verification: Security re-audit
6. Cleanup: Document security improvements
```

---

## Integration with Other Skills

### With pattern-task-breakdown

- Pattern-task-breakdown creates the plan
- Pattern-orchestration-complex executes the plan
- Use both together for planning phase

### With pattern-retry

- Pattern-retry handles quality gate failures
- Load when tasks don't meet criteria
- Both work together for quality assurance

---

## Troubleshooting

### "Plan keeps getting rejected by user"

- Make plan more detailed
- Break down tasks smaller
- Add more specific estimates
- Address user concerns explicitly

### "Tasks taking longer than estimated"

- Normal for some complexity
- Update user on progress
- Revise remaining estimates
- Consider if tasks need further breakdown

### "Quality gates keep failing"

- Requirements may be unclear
- Load pattern-retry skill
- May need to escalate agent
- Consider if task too complex (break down)

### "Lost track of progress"

- Check session context file
- Review commit history
- Update session state
- Document current status

---

## Quick Checklist

### Before Starting

- [ ] Task indicators suggest complexity (4+ files, >60 min, unclear approach)
- [ ] Delegated to agent.think for plan
- [ ] Plan presented to user
- [ ] User explicitly approved
- [ ] Session created with full context

### During Execution

- [ ] Executing one task at a time
- [ ] Quality gate after each task
- [ ] Using pattern-retry if needed
- [ ] Atomic commits per task
- [ ] Session state updated

### Before Finishing

- [ ] All tasks in plan complete
- [ ] Final verification performed
- [ ] All tests passing
- [ ] Summary created
- [ ] User notified of completion

### Cleanup

- [ ] Asked user about session cleanup
- [ ] Session archived or removed
- [ ] Follow-up items documented

---

## Remember

**Complex work needs structure** - Don't wing it
**Get approval before starting** - User may change scope
**One task at a time** - Complete fully before next
**Quality gates are mandatory** - Don't skip reviews
**Document as you go** - Update session regularly
**Atomic commits** - One task per commit
**Verify at the end** - Comprehensive final review
**Summarize the work** - Document what was built
