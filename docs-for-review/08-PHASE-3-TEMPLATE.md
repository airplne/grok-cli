# PRP Phase 3: Advanced Commands - TEMPLATE

**Status:** Template for future implementation
**Created:** 2026-01-03
**Prerequisites:** Phase 1 and Phase 2 complete

---

## Instructions for Creating Phase 3 PRP

After completing Phase 1 and Phase 2, use this template to create the Phase 3 PRP.

### Step 1: Review User Stories

From `USER-STORIES.md`, the remaining Phase 3 stories are:

**Configuration Commands (7 commands):**
- /config, /permissions, /output-style, /statusline, /hooks, /privacy-settings, /status

**Development Tools (6 commands):**
- /add-dir, /memory, /init, /review, /security-review, /todos

**Advanced Features (8 commands):**
- /agents, /mcp, /plugin, /bashes, /vim, /sandbox, /chrome, /ide

**Meta/System (6 commands):**
- /bug, /doctor, /login, /logout, /release-notes, /usage

**GitHub Integration (3 commands):**
- /install-github-app, /pr-comments, /terminal-setup

**Total:** 30 commands, ~30 files

---

## Step 2: Use This PRP Structure

Follow the proven format from Phase 1 and Phase 2:

### Section 1: Executive Summary
- Scope: Phase 3 specific features
- Effort estimate: 20-25 hours
- Dependencies on Phase 1 & 2

### Section 2: Requirements
- List all 30 commands with specifications
- Break into logical groups (Config, Dev, Advanced, Meta, GitHub)

### Section 3: Project Structure
```
src/commands/handlers/
  config/
    config.ts
    permissions.ts
    output-style.ts
    statusline.ts
    hooks.ts
    privacy-settings.ts
    status.ts
  dev/
    add-dir.ts
    memory.ts
    init.ts
    review.ts
    security-review.ts
    todos.ts
  advanced/
    agents.ts
    mcp.ts
    plugin.ts
    bashes.ts
    vim.ts
    sandbox.ts
    chrome.ts
    ide.ts
  meta/
    bug.ts
    doctor.ts
    login.ts
    logout.ts
    release-notes.ts
    usage.ts
  github/
    github-app.ts
    pr-comments.ts
    terminal-setup.ts
src/lib/
  usage-tracker.ts
  context-tracker.ts
  compactor.ts
src/ui/components/
  command-result.tsx
  settings-panel.tsx
```

### Section 4: Step-by-Step Implementation

**Step 3.1: Usage Tracking Infrastructure**
```typescript
// Complete code for src/lib/usage-tracker.ts
// Track tokens, costs, API calls
```

**Step 3.2: Context Tracker**
```typescript
// Complete code for src/lib/context-tracker.ts
// Track context window usage
```

**Step 3.3-3.32: Each Command Handler**
- One step per command
- Complete TypeScript code
- Integration instructions

**Step 3.33: UI Components**
```typescript
// src/ui/components/settings-panel.tsx
// Interactive settings UI
```

**Step 3.34: Final Integration**
- Register all commands in registry
- Update command list in help
- Test all features

### Section 5: Verification Checklist
- [ ] All 30 commands implemented
- [ ] TypeScript compiles
- [ ] All user story acceptance criteria pass
- [ ] No regressions in Phase 1 & 2
- [ ] Performance: p99 < 200ms
- [ ] Security review passed

### Section 6: Success Criteria
- Complete Claude Code parity
- 90%+ test coverage
- All HIGH priority user stories complete

---

## Step 3: Generate Detailed Implementation

Use a Claude agent to:
1. Read this template
2. Read USER-STORIES.md (stories for Phase 3)
3. Read Claude Code documentation for remaining commands
4. Generate complete TypeScript code for all 30 handlers
5. Follow the exact format from Phase 1 & 2 PRPs

**Prompt for the agent:**
```
Read the Phase 3 template, read USER-STORIES.md for Phase 3 requirements,
and create a complete PRP following the format of prp-phase-1-commands.md.

Include complete TypeScript code for all 30 command handlers, following
the same quality standard as Phase 1 and 2.

Write to: docs/prp-phase-3-advanced.md
```

---

## Notes

- Phase 3 is deferred until Phase 1 & 2 are complete and tested
- This template ensures consistency when Phase 3 is ready
- Estimated effort for creating Phase 3 PRP: 4-6 hours
- Estimated effort for executing Phase 3: 20-25 hours

---

**This template will be used after successful completion of Phases 1 and 2.**
