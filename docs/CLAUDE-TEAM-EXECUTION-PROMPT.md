# Execution Prompt for Claude Dev Team

## Task: Implement Keytar Ignore-Scripts Detection

**PRP Document**: `docs/PRP-KEYTAR-IGNORE-SCRIPTS-DETECTION.md` (enhanced, 100% ready)
**Branch**: Create new branch from `main` (or add to existing PR if preferred)
**Severity**: HIGH - Blocks auth on hardened systems
**Estimated Time**: 2-3 hours
**Risk**: LOW (read-only detection, graceful fallbacks)

---

## Problem Summary

Users with `npm ignore-scripts=true` (common on hardened dev machines) cannot use `grok auth login` because:
1. `npm rebuild keytar` doesn't work (scripts disabled)
2. CLI suggests this broken command
3. Users follow instructions exactly but remain stuck

## Solution

Detect `npm ignore-scripts=true` and provide correct fix: `npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts`

---

## Execution Checklist

### 1. Implement npm Detection (30 min)

**Create**: `src/auth/npm-diagnostics.ts`
- Function: `getNpmIgnoreScripts(cwd?: string): Promise<boolean | null>`
- Implementation in PRP Step 1 (complete code provided)
- Edge cases: npm not in PATH, timeout (2s), Windows env vars

### 2. Update Remediation Logic (45 min)

**File**: `src/auth/credential-store.ts`
- Line 291: Make `getRemediation()` async
- Line 306: Add `const npmIgnoreScripts = await getNpmIgnoreScripts()`
- Lines 327, 316, 337: Replace "npm rebuild keytar" with conditional block
- All 3 platforms: linux, darwin, win32

**Note**: All 6 call sites already use `await` (no caller updates needed)

### 3. Extract Keytar Loader for Testing (15 min)

**Create**: `src/auth/keytar-loader.ts`
```typescript
export async function loadKeytar() {
  const keytar = await import('keytar');
  return keytar;
}
```

**Update**: `src/auth/credential-store.ts`
- Replace `await getKeytar()` calls with `await loadKeytar()`

### 4. Add Tests (45 min)

**File**: `tests/unit/credential-store.test.ts`
- Mock `npm-diagnostics` and `keytar-loader`
- 4 test cases (complete patterns in PRP Step 4B)
- Verify remediation includes override when ignore-scripts=true

### 5. Update Documentation (15 min)

**File**: `docs/USAGE.md` or existing keytar docs
- Add troubleshooting bullet for ignore-scripts

---

## Verification Gates (MUST PASS)

```bash
# Build
npm run build

# Tests (should still be 319 or similar)
npm test

# Security check (no new credential paths)
rg -n "process\.env\.(GROK_API_KEY|XAI_API_KEY)" src/
# Should return: 0 matches

# Manual verification (if you have access to npm ignore-scripts environment)
npm config set ignore-scripts true
grok auth doctor
# Should show: npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts
```

---

## Key Implementation Details from PRP

**Injection Point**: `src/auth/credential-store.ts:327` (in Linux case, similar for darwin/win32)

**All Call Sites Already Async**:
- `src/auth/auth-service.ts:44, 142, 282`
- `src/index.tsx:176`
- `src/commands/handlers/auth.ts:74`
- `src/commands/handlers/auth-tui.ts:86`

**Test Mocking Pattern**: Use `vi.mock()` for npm-diagnostics and keytar-loader

**Edge Cases Handled**: npm timeout, npm not in PATH, Windows env vars, unexpected output → all return `null` (graceful fallback)

---

## Acceptance Criteria

✅ When `keytar.node` missing + `npm ignore-scripts=true`:
   - `grok auth doctor` shows `npm_config_ignore_scripts=false` override command

✅ When `keytar.node` missing + `npm ignore-scripts=false`:
   - Standard remediation (no override)

✅ When npm detection fails:
   - Graceful fallback to standard remediation

✅ All tests pass, build passes, no security regressions

---

## Reference

**Full PRP**: `docs/PRP-KEYTAR-IGNORE-SCRIPTS-DETECTION.md`
**Readiness Review**: `docs/PRP-KEYTAR-READINESS-REVIEW.md`
**Repo**: `airplne/grok-cli`
**Current Branch**: `feature/command-palette` (or create new from `main`)
