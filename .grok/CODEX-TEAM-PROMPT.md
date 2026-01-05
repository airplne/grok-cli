# Codex Team: Grok-CLI Enhancement Implementation Prompt

## Context

You are a senior engineer on the Codex team tasked with reviewing and implementing improvements to **grok-cli**, an AI-powered command-line interface built with TypeScript, React/Ink, and the xAI Grok API. A comprehensive Product Requirements Plan (PRP) has been prepared detailing all findings from a deep audit comparing grok-cli to Claude Code.

## Your Mission

Review the PRP at `/home/aip0rt/.claude/plans/valiant-orbiting-fern.md` and implement the improvements in priority order. The PRP contains production-ready code examples that you should adapt and integrate.

---

## Critical Priority: Permission System Bug

### The Problem
Users are forced to press 'Y' to confirm **every single Bash command** including safe read-only operations like `ls`, `git status`, and `cat`. This creates severe workflow disruption and "alert fatigue."

### Root Cause (Verified)
1. `src/security/permission-manager.ts:8` - Bash is excluded from `AUTO_APPROVED_TOOLS`
2. `src/tools/bash.ts:9` - `requiresConfirmation = true` is hardcoded
3. `src/ui/app.tsx:63,105` - `rememberedTools` only stores tool name, not specific commands
4. No persistent storage - approvals lost on restart

### Your Task
Implement the 5-step fix detailed in **Part 1.5** of the PRP:

1. **Create** `src/security/safe-commands.ts` - Safe command pattern detection (code provided)
2. **Update** `src/security/permission-manager.ts` - Add command-aware logic (code provided)
3. **Create** `src/security/permission-store.ts` - Persistent permission storage (code provided)
4. **Update** `src/ui/app.tsx` - Sophisticated approval memory system (code provided)
5. **Update** `src/ui/components/confirm.tsx` - Enhanced approval options (code provided)

### Success Criteria
```bash
# These should auto-approve WITHOUT prompting:
ls -la
git status
npm list
cat package.json
pwd

# These should STILL prompt:
git push origin main
npm install lodash
rm -rf node_modules
```

---

## Implementation Phases

### Phase 1: Critical UX (Do First)
1. Fix permission system (safe command bypass)
2. Add markdown rendering to message output
3. Add input history (up/down arrows)
4. Add `/compact` command for context management

### Phase 2: Feature Parity
5. Add WebFetch tool (`src/tools/web-fetch.ts`)
6. Add WebSearch tool (`src/tools/web-search.ts`)
7. Enhance Grep with output modes, context lines
8. Add session persistence

### Phase 3: Polish
9. Token tracking and cost display
10. Background Bash execution
11. Syntax highlighting
12. Multi-line input support

### Phase 4: Differentiation
13. MCP integration
14. Tool parallelization
15. Custom command system from `.grok/commands/`
16. Advanced subagent orchestration

---

## Key Files Reference

### Files to Modify
| File | Purpose |
|------|---------|
| `src/security/permission-manager.ts` | Permission logic (89 lines) |
| `src/tools/bash.ts` | Bash tool (83 lines) |
| `src/ui/app.tsx` | Main UI component (509 lines) |
| `src/ui/components/confirm.tsx` | Confirmation dialog (48 lines) |
| `src/ui/components/input.tsx` | Input component |
| `src/ui/components/message.tsx` | Message display |
| `src/tools/grep.ts` | Grep tool (98 lines) |
| `src/agent/grok-agent.ts` | Agent loop |

### New Files to Create
| File | Purpose |
|------|---------|
| `src/security/safe-commands.ts` | Safe command detection |
| `src/security/permission-store.ts` | Persistent permissions |
| `src/tools/web-fetch.ts` | WebFetch tool |
| `src/tools/web-search.ts` | WebSearch tool |
| `src/tools/bash-output.ts` | Background process output |
| `src/lib/markdown-renderer.ts` | Markdown rendering |
| `src/lib/session-manager.ts` | Session persistence |
| `src/lib/token-tracker.ts` | Token counting |

---

## Technical Constraints

1. **Stack**: TypeScript, React 18, Ink 4.x, Zod for validation
2. **Build**: `npm run build` compiles to `dist/`
3. **Entry**: `src/index.tsx` is the CLI entry point
4. **Security**: Must maintain 4-layer command allowlist defense
5. **Testing**: Run `npx tsc --noEmit` to verify types

---

## Security Requirements

**DO NOT** compromise security while fixing UX:
- The command allowlist at `src/security/command-allowlist.ts` MUST remain active
- Dangerous commands (`rm`, `sudo`, `curl`, `wget`, etc.) MUST still be blocked
- Safe command bypass is for READ-ONLY commands only
- Pattern matching must check for dangerous substrings (see `DANGEROUS_PATTERNS` in PRP)

---

## Review Checklist

Before submitting changes, verify:

- [ ] `ls`, `git status`, `npm list` auto-approve without prompts
- [ ] `rm -rf`, `sudo`, `git push` still require confirmation
- [ ] "Always this command" persists to `.grok-cli-permissions.json`
- [ ] "Trust similar" creates pattern like `git push *`
- [ ] Permission file is gitignored appropriately
- [ ] Types pass: `npx tsc --noEmit`
- [ ] Build succeeds: `npm run build`

---

## Questions to Consider

1. Should safe commands be configurable per-project in `.grok/config`?
2. Should there be a "paranoid mode" CLI flag to override safe command bypass?
3. How should permission patterns handle shell metacharacters?
4. Should we add audit logging for security-sensitive permission decisions?

---

## Getting Started

```bash
# 1. Read the full PRP
cat /home/aip0rt/.claude/plans/valiant-orbiting-fern.md

# 2. Understand current permission flow
cat src/security/permission-manager.ts
cat src/ui/app.tsx | head -120

# 3. Start with safe-commands.ts (new file)
# Copy the implementation from PRP Part 1.5, Step 1

# 4. Update permission-manager.ts
# Add the isSafeBashCommand import and logic

# 5. Test iteratively
npm run build && ./dist/index.js
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Permission prompts per typical session | 50+ | <5 |
| Commands available | 6 | 15+ |
| Tools available | 9 | 12+ |
| Feature parity with Claude Code | 60-70% | 95%+ |

---

## Contact

For questions or clarifications, refer to the full PRP at:
`/home/aip0rt/.claude/plans/valiant-orbiting-fern.md`

The PRP contains ~700 lines of detailed analysis, code examples, and implementation guidance.

---

*Generated: January 5, 2026*
*PRP Version: 1.0*
