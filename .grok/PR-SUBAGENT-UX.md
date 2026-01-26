## Summary

Fixes UX confusion where users misinterpret subagent evidence as "no spawn occurred."

**Problem**: Subagents correctly show `Subagents spawned: 0 (subagents cannot spawn subagents)` in their own evidence block, but users misread this as indicating the subagent didn't run at all.

**Solution**: Add explicit `=== SUBAGENT RUN (system) ===` header to Task output that unambiguously declares:
- What subagent type was spawned
- The unique agent ID
- What tools the subagent was allowed to use
- Why the subagent's own evidence shows "0"

## Changes

**Core Changes**:
- `src/agents/types.ts`: Add `subagentType` + `allowedTools` to `SubagentResult`
- `src/agents/subagent-runner.ts`: Include these fields in all return paths
- `src/tools/task.ts`: Prepend SUBAGENT RUN header to successful Task outputs
- `tests/unit/truthfulness.test.ts`: Add 6 regression tests for header presence

**Header Format**:
```
=== SUBAGENT RUN (system) ===
subagent_type: explore
agentId: subagent-1768766355-x9fk2a
allowedTools: Read, Grep, Glob
note: subagent evidence shows "Subagents spawned: 0" because subagents cannot spawn subagents

[subagent output follows...]

=== SUBAGENT TRACE ===
Tool calls: 2
[1] ✓ Grep: "pattern"
[2] ✓ Read: file.ts

=== EVIDENCE ===
Tools executed: Grep(1), Read(1)
Total tool calls: 2
Subagents spawned: 0 (subagents cannot spawn subagents)
```

## UX Impact

**Before** (confusing):
- User sees `Subagents spawned: 0` in Task output and thinks nothing happened
- No clear indication a subagent actually ran

**After** (unambiguous):
- Clear header declares: "SUBAGENT RUN (system)"
- Shows exact subagent type, ID, and allowed tools
- Explains why subagent evidence shows "0"
- Main agent evidence (`Subagents spawned (via Task): 1`) remains authoritative

## Verification

```bash
✅ npm run build - TypeScript compilation clean
✅ npm test - 204/204 tests pass (+6 new tests)
✅ Header fields tested: type, agentId, allowedTools, explanatory note
```

## Test Coverage

**New Tests** (6 added to `tests/unit/truthfulness.test.ts`):
- Detects all required header fields in mock output
- Validates subagent_type field format
- Validates agentId field format
- Validates allowedTools field format
- Validates explanatory note presence
- Rejects output without proper header

**Total**: 204 tests (was 198 in PR #7)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
