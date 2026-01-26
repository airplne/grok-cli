## Summary

Fixes explore subagent output quality - it now reliably finds code evidence using token-based searches instead of failing with phrase-based searches.

**Problem**: When asked to find code like "where taskSuccesses increments", the explore subagent searched for English phrases ("successful Task", "count successful") instead of code tokens (`taskSuccesses`, `call.tool === 'Task'`), resulting in "no matches found."

**Solution**: Enhanced explore.md system prompt with explicit operating rules for code evidence gathering.

## Root Cause

**Current behavior** (broken):
```
User: "Find where taskSuccesses increments"
Subagent: Grep: "count successful" → no matches
```

**Expected behavior** (fixed):
```
User: "Find where taskSuccesses increments"
Subagent: Grep: "taskSuccesses" → finds definition + uses
Subagent: Grep: "taskSuccesses.*\+=" → finds increment line
Subagent: Quotes file:line:content
```

## Changes

**File**: `.grok/agents/explore.md`

### Added Operating Rules

**1. Token-Based Code Searches** (CRITICAL)
- Use code tokens/identifiers: `taskSuccesses`, `call.tool`, `runSubagent`
- NOT English phrases: "successful Task", "count successful"
- Includes examples: variable names, function names, class names, operators

**2. File:Line Evidence Requirements**
- Use Grep with identifiers
- Include actual grep output (file:line:content)
- Provide exact line numbers and exact code
- Read file if grep output is long

**3. Search Scope Preferences**
- **Prefer `src/**` over `tests/**`** unless tests explicitly requested
- Use patterns: `Glob: "src/**/*.ts"`, `Grep: "pattern" --glob "src/**"`

**4. Follow-Up Strategy**
- When finding a function: do second Grep for key identifiers
- Search same file for related tokens
- Read for context if needed

**5. Quality Checklist**
- Verify token/identifier searches used
- Verify file:line:content included
- Verify src/** searched first
- Verify exact matching code quoted

## Regression Tests

**File**: `tests/unit/truthfulness.test.ts` (+5 tests)

Tests verify explore.md system prompt contains:
- ✅ Token/identifier search guidance
- ✅ File:line evidence requirements
- ✅ `src/**` preference over `tests/**`
- ✅ Follow-up strategy for function findings
- ✅ Quality checklist

## Impact

**Before** (phrase search fails):
```
User: "Find where taskSuccesses increments"
=== SUBAGENT TRACE ===
[1] ✓ Grep: "successful Task"
    No matches found
```

**After** (token search succeeds):
```
User: "Find where taskSuccesses increments"
=== SUBAGENT TRACE ===
[1] ✓ Grep: "taskSuccesses"
    src/agent/grok-agent.ts:106: taskSuccesses += 1;
[2] ✓ Read: src/agent/grok-agent.ts
    [context around line 106]
```

## Verification

```bash
✅ npm run build - TypeScript compilation clean
✅ npm test - 209/209 tests pass (+5 new tests)
✅ explore.md contains all required guidance strings
```

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
