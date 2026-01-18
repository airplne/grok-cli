## Summary

Resolves all Codex NO-GO findings from security audit:

- **F1 (HIGH)**: `/prompt` command now uses secure path validation
- **F2 (HIGH)**: Agent events include `callId` + `args` for reliable trace correlation
- **F3 (MEDIUM)**: Subagent trace uses deterministic `callId` mapping
- **F4 (MEDIUM)**: Documentation updated (removed `npm test -- --run`)
- **F5 (LOW)**: Comprehensive test coverage added (+30 tests)

## Changes

### Security Hardening

**`/prompt` Command** (`src/commands/handlers/prompt.ts`)
- ✅ Uses `validateAndOpen()` from path-validator (no raw fs bypass)
- ✅ Enforces 256KB (262,144 bytes) max file size
- ✅ Rejects directories, empty files, forbidden paths
- ✅ Atomic file handle with proper cleanup
- ✅ Tested against: `/etc/passwd`, `.env`, path traversal, oversized files

### Subagent Trace Reliability

**AgentEvent Interface** (`src/agent/grok-agent.ts`)
- Added `callId?: string` for tool call correlation
- Added `args?: unknown` for argument inspection
- All `tool_start` and `tool_result` events now include these fields

**Trace Correlation** (`src/agents/subagent-runner.ts`)
- Uses `pendingByCallId: Map<...>` for deterministic correlation
- Creates trace placeholder on `tool_start`
- Updates trace entry on `tool_result` by `callId`
- Handles repeated tool calls correctly (no name-based keying)
- Args summary extracted from `event.args` (not result hacks)

**Trace Output Format**:
```
=== SUBAGENT TRACE ===
Tool calls: 3

[1] ✓ Glob: src/agent/**/*.ts
    Found 3 matching files...

[2] ✓ Read: src/agent/grok-agent.ts
    import OpenAI from 'openai'...

[3] ✓ Grep: "computeToolCallEvidence" in src/agent/grok-agent.ts
    62:export function computeToolCallEvidence...
```

### Paste Reliability

**Bracketed Paste Support** (`src/ui/utils/bracketed-paste.ts`)
- Extracted pure state machine for testability
- Handles multi-line paste without premature submission
- Detects `\x1b[200~` ... `\x1b[201~` sequences
- Accumulates content across chunks

**Input Component** (`src/ui/components/input.tsx`)
- Uses bracketed-paste utility
- Shows `[pasting...]` indicator
- Displays line count for multi-line input

### UI Improvements

**System Evidence Distinction** (`src/ui/components/message.tsx`)
- Evidence blocks show as magenta "Evidence (system-verified)" boxes
- Bordered for visual clarity
- Prevents confusion with assistant output

**Tool Output Viewer** (`src/ui/components/tool-output.tsx`)
- Head+tail truncation preserves evidence blocks (default: 8K + 8K chars)
- Navigate with ↑/↓ or j/k keys
- Expand/collapse with `e` key
- Selection indicator with cyan border

**Evidence Wording Clarity** (`src/agent/grok-agent.ts`)
- Main agent: "Subagents spawned (via Task): X"
- Subagent: "Subagents spawned: 0 (subagents cannot spawn subagents)"

### Truthfulness Enforcement

**TRUTHFULNESS_RULES Extended**
- Rule 6: Never fabricate evidence blocks
- Rule 7: Never claim "FULL tool output verbatim"
- Instructs model to direct users to TUI controls (↑/↓, e to expand)

### Documentation

**Fixed Test Command** (15 files updated)
- ❌ `npm test -- --run` (causes double --run error)
- ✅ `npm test` (correct, already includes --run)

**Untracked Local State** (`.gitignore`)
- `.claude/config/background-music-position.txt`
- `.claude/github-star-reminder.txt`
- `.claude/github-star-reminder-disabled.flag`

## Test Coverage

**New Test Files**:
- `tests/unit/prompt-command.test.ts` (18 tests)
  - Security: blocks forbidden paths, validates sizes
  - Functionality: loads files, preserves content
- `tests/unit/bracketed-paste.test.ts` (12 tests)
  - State machine: multi-chunk assembly, transitions
  - Display: multi-line formatting

**Test Results**:
- Before: 168 tests
- After: **198 tests** (+30 new tests)
- All passing: ✅ 198/198

## Verification

```bash
✅ npm run build - TypeScript compilation clean
✅ npm test - 198/198 tests pass
✅ rg "npm test -- --run" - 0 matches
✅ rg "process\.env\.(GROK_API_KEY|XAI_API_KEY)" src - 0 matches
✅ No raw fs.readFile in src/commands/handlers/prompt.ts
✅ AgentEvent includes callId + args
✅ Trace uses pendingByCallId (deterministic)
```

## Base Commit

- **SHA**: `f837148573d8fa0a834ca627d2d26b11333140b6`
- **Version**: v2.0.4
- **Node**: v22.21.1
- **npm**: 11.6.1

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
