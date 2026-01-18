# security: harden grep tool fallback + add path-validator regression tests (ARCHIVED PR BODY)

**ARCHIVE NOTE**: This file captured the draft PR description for PR #1. PR #1 is merged to `main`
(squash merge commit `39f1d7e58519943b960c318e20f557aa4b43e9b5`). For the authoritative post-merge
report, see `docs/PR-CODEX-FIXES-IMPLEMENTATION.md`.

## Summary

- Hardened grep tool against dash-prefixed pattern misinterpretation via `--` separator
- Fixed fallback race conditions with consolidated state + stale event guards + deterministic scheduling
- Added symlink/path-validator regression tests and comprehensive grep tool tests
- Updated implementation report to match current code/tests

## Changes

### Security Fixes (src/tools/grep.ts)

1. **Pattern Injection Prevention** (lines 66, 72):
   - Added `--` separator before pattern args for both `rg` and `grep`
   - Prevents patterns like `-e malicious` from being interpreted as flags

2. **Race Condition Prevention** (lines 76-86):
   - Consolidated state into `{ resolved, activeProcess }` object
   - Added `finish()` gate to prevent double-resolution
   - Stale event checks on lines 98, 110

3. **Deterministic Fallback** (line 114):
   - Used `setImmediate()` to properly sequence rg→grep fallback
   - Prevents stale events from abandoned rg process

4. **Improved Error UX** (lines 119-128):
   - Helpful installation instructions when both tools missing

### Path Validator Updates (src/security/path-validator.ts)

- Ensured `.env.example`/`.env.sample`/`.env.template` allowed for read-only
- Symlink resolution and blocked pattern checks against resolved paths

### Test Coverage

- **tests/unit/grep-tool.test.ts** (25 tests):
  - Pattern handling, fallback behavior, security, validation
  - Mocked fallback tests with proper async sequencing via `flushImmediate()`

- **tests/unit/path-validator.test.ts** (35 tests):
  - Symlink regression tests with fixtures in `$HOME` to avoid Vitest watch mode ELOOP
  - Blocked patterns, path injection, write protection

## Verification

```bash
npm test
```

**Results**:
```
 Test Files  3 passed (3)
      Tests  68 passed (68)
   Duration  2.26s
```

**Watch mode**:
```bash
npm test
```
No ELOOP errors from circular symlink fixtures.

## Documentation

- **PRP**: `docs/PRP-SECURITY-CODE-QUALITY-FIXES.md`
- **Implementation Report**: `docs/PR-CODEX-FIXES-IMPLEMENTATION.md`

Both documents contain exact line numbers, code snippets, and rationale for each change.

## Files Changed

- `src/tools/grep.ts` (+125, -0 lines)
- `src/security/path-validator.ts` (+15, -0 lines)
- `tests/unit/grep-tool.test.ts` (NEW: 390 lines)
- `tests/unit/path-validator.test.ts` (NEW: 560 lines)
- `docs/PRP-SECURITY-CODE-QUALITY-FIXES.md` (NEW: 621 lines)
- `docs/PR-CODEX-FIXES-IMPLEMENTATION.md` (NEW: 301 lines)

Total: +1987, -25 lines
