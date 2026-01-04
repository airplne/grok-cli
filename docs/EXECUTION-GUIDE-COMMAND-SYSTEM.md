# Execution Guide: grok-cli Command System Implementation

**Created:** 2026-01-03
**For:** Claude Development Team
**Project:** grok-cli Phase 2 - Command System
**Status:** Ready for Execution

---

## 📋 Documentation Deliverables

Your comprehensive planning documentation is ready. All files are located in `/home/aip0rt/Desktop/grok-cli/docs/`:

| Document | Size | Lines | Purpose |
|----------|------|-------|---------|
| **PRD-COMMAND-SYSTEM.md** | 37K | ~950 | Product Requirements - WHAT and WHY |
| **prp-phase-1-commands.md** | 55K | ~1,400 | Precise Requirements - HOW (Phase 1) |
| **prp-phase-2-sessions.md** | 59K | ~1,500 | Precise Requirements - HOW (Phase 2) |
| **USER-STORIES.md** | 33K | ~850 | Agile Stories - User perspective |
| **TOTAL** | 184K | **6,659 lines** | Complete specification |

---

## 🎯 What's Been Specified

### Scope: Complete Claude Code Parity

**40+ Slash Commands** organized in 7 domains:
1. **Core** (8): /help, /exit, /clear, /model, /history, /cost, /context, /compact
2. **Session** (5): /resume, /rename, /session, /export, /rewind
3. **Config** (7): /config, /permissions, /output-style, /statusline, /hooks, /privacy-settings, /status
4. **Dev Tools** (6): /add-dir, /memory, /init, /review, /security-review, /todos
5. **Advanced** (8): /agents, /mcp, /plugin, /bashes, /vim, /sandbox, /chrome, /ide
6. **Meta** (6): /bug, /doctor, /login, /logout, /release-notes, /usage
7. **GitHub** (3): /install-github-app, /pr-comments, /terminal-setup

**20+ CLI Flags:**
- Session: `--resume`, `--session`, `--fork-session`, `--session-id`
- Model: `--model`, `--agent`, `--fallback-model`
- Tools: `--allowedTools`, `--disallowedTools`, `--tools`
- Output: `--print`, `--output-format`, `--verbose`
- Config: `--settings`, `--mcp-config`, `--add-dir`
- Debug: `--debug`, `--version`, `--help`

**Infrastructure:**
- Session management (save/load/resume/export)
- Model switching at runtime
- Configuration system
- Usage/cost tracking
- Context visualization

---

## 📖 How to Use These Documents

### For Product Managers
**Read:** `PRD-COMMAND-SYSTEM.md`
- Understand user needs and success criteria
- Review timelines and phasing
- Validate against business requirements

### For Architects
**Read:** PRD + Both PRPs
- Review architecture decisions
- Validate file structure
- Check integration points

### For Developers (IMPLEMENTATION)
**Follow this sequence:**

#### Phase 1: Essential Commands (Week 1 - 4-6 hours)
1. **Read:** `prp-phase-1-commands.md`
2. **Execute:** Steps 1-12 exactly as written
3. **Verify:** 20+ checklist items
4. **Result:** /help, /model, /clear, /exit, /history working

#### Phase 2: Session Management (Week 2 - 6-8 hours)
1. **Read:** `prp-phase-2-sessions.md`
2. **Execute:** Steps 1-12 exactly as written
3. **Verify:** 30+ checklist items
4. **Result:** Full session save/resume/export system

#### Phase 3: Advanced Features (Weeks 3-5 - 15-20 hours)
1. **Read:** `USER-STORIES.md` for remaining stories
2. **Design:** Create PRP Phase 3 for remaining 27 commands
3. **Execute:** Implement configuration, dev tools, advanced features
4. **Result:** Complete Claude Code parity

### For QA/Testing
**Read:** USER-STORIES.md
- Each story has acceptance criteria
- 31 testable user stories
- Priority-based test planning

---

## 🏗️ Architecture Overview

### New File Structure (40+ files to create)

```
src/
  commands/
    types.ts              # ← Phase 1, Step 1
    parser.ts             # ← Phase 1, Step 2
    index.ts              # ← Phase 1, Step 9
    registry.ts           # ← Phase 2, Step 5
    handlers/
      core/
        help.ts           # ← Phase 1, Step 4
        model.ts          # ← Phase 1, Step 5
        clear.ts          # ← Phase 1, Step 6
        exit.ts           # ← Phase 1, Step 7
        history.ts        # ← Phase 1, Step 8
        cost.ts           # ← Phase 3
        context.ts        # ← Phase 3
        compact.ts        # ← Phase 3
      session/
        session.ts        # ← Phase 2, Step 6
        resume.ts         # ← Phase 2, Step 7
        rename.ts         # ← Phase 2, Step 8
        export.ts         # ← Phase 2, Step 9
        rewind.ts         # ← Phase 3
      config/
        [7 handlers]      # ← Phase 3
      dev/
        [6 handlers]      # ← Phase 3
      advanced/
        [8 handlers]      # ← Phase 3
      meta/
        [6 handlers]      # ← Phase 3
      github/
        [3 handlers]      # ← Phase 3
  session/
    types.ts              # ← Phase 2, Step 1
    storage.ts            # ← Phase 2, Step 2
    manager.ts            # ← Phase 2, Step 3
  config/
    models.ts             # ← Phase 1, Step 3
    cli-args.ts           # ← Phase 1, Step 11
    settings.ts           # ← Phase 3
  ui/
    app.tsx               # ← MODIFIED Phase 1, Step 10 & Phase 2, Step 11
    components/
      command-result.tsx  # ← Phase 3
      session-picker.tsx  # ← Phase 3
      model-picker.tsx    # ← Phase 3
  lib/
    usage-tracker.ts      # ← Phase 3
    context-tracker.ts    # ← Phase 3
    compactor.ts          # ← Phase 3
```

---

## ⏱️ Estimated Timeline

| Phase | Duration | Effort | Files | Commands |
|-------|----------|--------|-------|----------|
| Phase 1 | Week 1 | 4-6 hours | 9 files | 5 commands |
| Phase 2 | Week 2 | 6-8 hours | 12 files | 5 commands |
| Phase 3 | Weeks 3-5 | 20-25 hours | 30+ files | 30+ commands |
| **Total** | **5 weeks** | **30-40 hours** | **50+ files** | **40+ commands** |

---

## ✅ Success Criteria (from PRD)

### Phase 1 Complete When:
- [ ] All 5 essential commands work (/help, /model, /clear, /exit, /history)
- [ ] Model switching works at runtime
- [ ] CLI flags work (--model, --help, --version)
- [ ] TypeScript compiles with no errors
- [ ] Backward compatible (existing prompts still work)
- [ ] 80%+ test coverage on command handlers

### Phase 2 Complete When:
- [ ] Sessions save/load/resume work
- [ ] Export to JSON/Markdown works
- [ ] CLI flag --resume works
- [ ] Auto-save after each turn
- [ ] Session picker UI (if implemented)
- [ ] 85%+ test coverage

### Phase 3 Complete When:
- [ ] All 40+ commands implemented
- [ ] All 20+ CLI flags work
- [ ] Complete Claude Code parity
- [ ] 90%+ test coverage
- [ ] Performance: p99 < 200ms for command execution

---

## 🚀 Quick Start for Developers

### 1. Read the PRD First
```bash
cd /home/aip0rt/Desktop/grok-cli
cat docs/PRD-COMMAND-SYSTEM.md
```

**Understand:**
- Why we're building this
- User needs driving each feature
- Success metrics

### 2. Execute Phase 1 PRP
```bash
cat docs/prp-phase-1-commands.md
```

**Follow steps 1-12 exactly:**
- Each step has complete TypeScript code
- Copy-paste into new files
- Verify after each step
- Test incrementally

### 3. Execute Phase 2 PRP
```bash
cat docs/prp-phase-2-sessions.md
```

**Follow steps 1-12 for session system**

### 4. Design Phase 3
**Use:** USER-STORIES.md as requirements
- Remaining 27 commands need PRPs
- Follow same pattern as Phase 1 & 2

---

## 🧪 Testing Strategy

### Unit Tests (from PRPs)
Each PRP includes verification checklists:
- **Phase 1:** 20+ verification items
- **Phase 2:** 30+ verification items

### Integration Tests (from User Stories)
Each user story has acceptance criteria:
- 31 stories × 3-5 criteria each = 100+ test cases

### Manual Testing
```bash
# Phase 1 smoke test
grok --help
grok --version
grok --model grok-4 "test"
# In session:
/help
/model
/clear
/history
/exit

# Phase 2 smoke test
grok --session my-test
/session save
/session list
/resume my-test
/export test.json
```

---

## 📚 Document Relationships

```
PRD-COMMAND-SYSTEM.md (Product Requirements)
  ├── Defines WHAT to build
  ├── Defines WHY (user needs)
  └── Defines success criteria
      |
      ├─> prp-phase-1-commands.md (Infrastructure + Essential)
      |     └── HOW to build Phase 1 (exact code)
      |
      ├─> prp-phase-2-sessions.md (Session Management)
      |     └── HOW to build Phase 2 (exact code)
      |
      └─> USER-STORIES.md (Agile Stories)
            ├── User perspective on features
            ├── Acceptance criteria for testing
            └── Effort estimates for planning
```

---

## 🎯 Recommended Execution Approach

### Option A: Sequential (Lower Risk)
1. Week 1: Execute Phase 1 PRP → Test → Ship
2. Week 2: Execute Phase 2 PRP → Test → Ship
3. Weeks 3-5: Execute Phase 3 → Test → Ship

**Pros:** Lower risk, faster feedback, iterative validation
**Cons:** Longer total calendar time

### Option B: Parallel (Faster)
1. Split team into 3 groups
2. Group 1: Phase 1 (1 dev, Week 1)
3. Group 2: Phase 2 (1 dev, Week 1-2)
4. Group 3: Phase 3 (2 devs, Week 2-5)
5. Integration Week 6

**Pros:** Faster delivery (6 weeks vs 5 weeks sequential)
**Cons:** Higher integration risk

### Option C: MVP First (Recommended)
1. Week 1: Phase 1 only
2. **Ship MVP** with 5 essential commands
3. Gather user feedback
4. Week 2+: Phase 2 & 3 based on actual usage patterns

**Pros:** Fastest to value, user-driven priorities
**Cons:** May need to refactor based on feedback

---

## 🔧 Dependencies to Install

From PRD Section 8, add these to package.json:

```json
{
  "dependencies": {
    "commander": "^11.0.0",    // CLI arg parsing
    "enquirer": "^2.4.0",      // Interactive prompts
    "table": "^6.8.0",         // Table formatting
    "pretty-bytes": "^6.1.0",  // Byte formatting
    "date-fns": "^3.0.0"       // Date formatting
  }
}
```

---

## ⚠️ Critical Notes

### Backwards Compatibility (MUST PRESERVE)
From PRD Section 6.4:
- Existing prompt usage MUST work unchanged
- No breaking changes to tool interfaces
- Exit commands (exit/quit) MUST work
- Model defaults MUST remain `grok-4-1-fast`

### Security Considerations (MUST REVIEW)
From PRD Section 6.3:
- Session files may contain sensitive data → encrypt or secure storage
- Command handlers must validate inputs
- Configuration files must be validated against schema
- CLI flags must not bypass security controls

### Performance Requirements (MUST MEET)
From PRD Section 6.2:
- Command parsing: < 5ms (p99)
- Command execution: < 100ms (p99)
- Session load: < 500ms (p99)
- No impact on agent streaming performance

---

## 📊 Effort Estimation Summary

From USER-STORIES.md:

| Priority | Stories | Effort | Percentage |
|----------|---------|--------|------------|
| HIGH | 14 | 32 hours | 49% |
| MEDIUM | 13 | 29 hours | 45% |
| LOW | 4 | 4 hours | 6% |
| **Total** | **31** | **65 hours** | **100%** |

**Critical Path:** HIGH priority stories (32 hours) must be completed first.

---

## 🎯 Next Steps for Dev Team

1. **Review all 4 documents** (2-3 hours read time)
2. **Ask clarifying questions** before starting
3. **Set up development environment:**
   ```bash
   cd /home/aip0rt/Desktop/grok-cli
   git checkout -b feature/command-system
   npm install commander enquirer table pretty-bytes date-fns
   ```
4. **Start with Phase 1 PRP:**
   - Open `docs/prp-phase-1-commands.md`
   - Follow Steps 1-12 exactly
   - Create 9 new files
   - Verify after each step
5. **Commit and test** before moving to Phase 2
6. **Repeat** for Phase 2, then Phase 3

---

## 📝 PRD Overview (What You're Building)

From `PRD-COMMAND-SYSTEM.md`:

### Executive Summary
Enhance grok-cli from basic Phase 1 (7 tools) to full-featured CLI with 40+ commands, matching Claude Code's capabilities. Enables:
- Runtime model switching
- Session persistence and resume
- Rich help and documentation
- Configuration management
- Usage tracking and cost visibility

### Goals (G1-G5)
1. **G1:** Implement 40+ slash commands with intuitive UX
2. **G2:** Enable session save/resume for conversation continuity
3. **G3:** Provide runtime model switching (5 Grok models)
4. **G4:** Add comprehensive help and documentation
5. **G5:** Maintain 100% backwards compatibility

### Non-Goals (Deferred to Future)
- MCP server integration
- Subagent system
- Web search tools
- IDE integration
- GitHub integration

---

## 📐 PRP Phase 1 Overview (Infrastructure)

From `prp-phase-1-commands.md`:

### What Phase 1 Builds
**9 new files, 2 modified files**

**Command Infrastructure:**
- `src/commands/types.ts` - Core interfaces (CommandContext, CommandResult, Command)
- `src/commands/parser.ts` - Slash command parser with quote handling
- `src/commands/index.ts` - Command registry and dispatcher
- `src/config/models.ts` - All 5 Grok models with pricing data

**Essential Commands (5):**
- `/help` - Display command list
- `/model [name]` - Switch models or show current
- `/clear` - Clear conversation
- `/exit` - Exit CLI
- `/history` - Show message count/preview

**Integration:**
- `src/ui/app.tsx` - Add command routing, model state
- `src/index.tsx` - Add --help, --version, --list-models flags

### Example Code Quality

Every file has complete, copy-paste ready TypeScript:
```typescript
// Example from Step 1 - types.ts
export interface CommandContext {
  currentModel: string;
  messages: Message[];
  setModel: (model: string) => void;
  clearMessages: () => void;
  addSystemMessage: (content: string) => void;
  exit: () => void;
}
// ... 80+ more lines with full implementations
```

---

## 📐 PRP Phase 2 Overview (Sessions)

From `prp-phase-2-sessions.md`:

### What Phase 2 Builds
**12 files total (7 new, 5 modified)**

**Session Infrastructure:**
- `src/session/types.ts` - Session, SessionMessage, ExportFormat interfaces
- `src/session/storage.ts` - SessionStorage class (CRUD operations)
- `src/session/manager.ts` - SessionManager (high-level API)

**Session Commands (4):**
- `/session list|save|delete|info` - Manage sessions
- `/resume [id]` - Resume previous session
- `/rename <name>` - Rename current session
- `/export [id] [--format] [--output]` - Export to JSON/MD/TXT

**Features:**
- Auto-save after each turn
- Dual storage (project `.grok/` and global `~/.grok/`)
- Export formats: JSON, Markdown, plain text
- Session metadata (timestamps, model, cwd)

---

## 📋 User Stories Overview

From `USER-STORIES.md`:

### Epic Breakdown

**31 user stories** across 9 epics:

1. **Model Management** (2 stories, 4h total)
2. **Session Management** (6 stories, 14h total)
3. **Conversation Management** (4 stories, 8h total)
4. **Help System** (2 stories, 4h total)
5. **Configuration** (4 stories, 8h total)
6. **Usage Tracking** (2 stories, 6h total)
7. **Development Tools** (4 stories, 8h total)
8. **CLI Flag Parsing** (5 stories, 11h total)
9. **Backwards Compatibility** (2 stories, 4h total)

Each story includes:
- User perspective ("As a developer, I want...")
- Acceptance criteria (testable)
- Technical notes
- Priority (HIGH/MEDIUM/LOW)
- Effort estimate (S/M/L/XL)

---

## 🔍 Code Examples from PRPs

### Parser Example (from Phase 1 PRP)
```typescript
// src/commands/parser.ts - Lines 1-50
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const withoutPrefix = trimmed.slice(1);
  const spaceIndex = withoutPrefix.indexOf(' ');
  // ... full implementation with quote handling
}
```

### Session Manager Example (from Phase 2 PRP)
```typescript
// src/session/manager.ts - Lines 1-120
export class SessionManager {
  async create(messages: Message[], model: string): Promise<string> {
    const session: Session = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      model,
      messages: messages.map(serializeMessage),
      // ... full implementation
    };
    await SessionStorage.save(session);
    return session.id;
  }
  // ... save, load, list, delete, export methods
}
```

---

## 🎓 Learning from Phase 1 (grok-cli Build)

**What worked well:**
- ✅ Parallel Opus agents (4 agents created 28 files in ~6 minutes)
- ✅ Exact code in PRP (copy-paste quality)
- ✅ Incremental verification
- ✅ Clear file structure

**What to improve:**
- ⚠️ Anti-flickering had bugs (took 3 iterations to fix)
- ⚠️ Security needed hardening (found CRITICAL issues after build)
- ⚠️ UI state management was complex (needed 4 debug agents)

**Apply to Phase 2:**
- Review state management patterns carefully
- Add debug logging from the start
- Test command integration thoroughly
- Consider security implications of session storage

---

## 📞 Contact & Questions

**Project Location:** `/home/aip0rt/Desktop/grok-cli`

**Key Reference Files:**
- Original Phase 1 PRP: `docs/prp-claude-build-grok-cli.md`
- Original execution guide: `docs/EXECUTION-PROMPT.md`
- Bug reports: `BUG-REPORT-TEXT-DISAPPEARING.md`
- This guide: `docs/EXECUTION-GUIDE-COMMAND-SYSTEM.md`

**For Questions:**
- Refer to PRD for product decisions
- Refer to PRPs for technical decisions
- Refer to User Stories for acceptance criteria

---

## ✨ Final Notes

**This is a massive undertaking** - 40+ commands, 50+ files, 65 hours of work. The documentation is production-ready and executable.

**Recommendation:** Start with Phase 1 (Week 1, 4-6 hours). Ship it. Validate. Then proceed to Phase 2.

**The PRPs are designed to be followed by Claude dev agents** - every file has exact code. A Claude agent could execute these PRPs and build the entire system.

---

**Status:** ✅ Ready for Development Team
**Documentation Quality:** ULTRATHINK standard
**Next Action:** Review PRD → Execute Phase 1 PRP

Good luck! 🚀
