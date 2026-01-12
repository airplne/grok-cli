# Codex Team Fixes: Implementation Report

**PR Type**: Security Hardening + Test Stability
**Status**: Complete
**Date**: 2026-01-12

---

## Context

This document covers the implementation of fixes identified during the Codex team review of grok-cli. The primary focus is on hardening the grep tool against pattern injection attacks, preventing race conditions in async fallback logic, and improving test reliability.

**Related PRP**: `docs/PRP-SECURITY-CODE-QUALITY-FIXES.md`

---

## Changes Implemented

### 1. src/tools/grep.ts - Security & Stability Fixes

#### Fix 1: Pattern Injection Prevention (CODE-003)

**Lines**: `src/tools/grep.ts:66`, `src/tools/grep.ts:72`

Added `--` separator before pattern arguments to prevent patterns starting with `-` from being misinterpreted as command flags.

```typescript
// src/tools/grep.ts:66 - ripgrep args
rgArgs.push('--', pattern, validated.resolvedPath!);

// src/tools/grep.ts:72 - grep fallback args
grepArgs.push('--', pattern, validated.resolvedPath!);
```

**Why this matters**: Without `--`, a pattern like `-e malicious` could be interpreted as ripgrep/grep flags rather than a literal search string, potentially enabling command injection or unexpected behavior.

#### Fix 2: Consolidated State Object (CODE-001)

**Lines**: `src/tools/grep.ts:76-79`

Replaced scattered mutable variables with a single consolidated state object to prevent race conditions.

```typescript
const state = {
  resolved: false,
  activeProcess: null as ChildProcess | null,
};
```

**State Properties**:
- `resolved`: Boolean flag ensuring the promise resolves exactly once
- `activeProcess`: Tracks which process (rg or grep) is currently active, used to ignore stale events

#### Fix 3: finish() Gate Function (CODE-001)

**Lines**: `src/tools/grep.ts:81-86`

Added atomic `finish()` gate to prevent double-resolution of the search promise.

```typescript
const finish = (result: ToolResult) => {
  if (state.resolved) return;
  state.resolved = true;
  state.activeProcess = null;
  resolve(result);
};
```

**Why this matters**: Both `close` and `error` events can fire from the same process, and during fallback, events from both `rg` and `grep` processes could theoretically fire. The `finish()` gate with `state.resolved` check ensures we only resolve once.

#### Fix 4: Stale Event Handling (CODE-002)

**Lines**: `src/tools/grep.ts:98` (close handler), `src/tools/grep.ts:110` (error handler)

Added identity checks to ignore events from processes that are no longer active.

```typescript
// src/tools/grep.ts:98 - in close handler
if (state.activeProcess !== proc) return;

// src/tools/grep.ts:110 - in error handler
if (state.activeProcess !== proc) return;
```

**Why this matters**: When fallback from rg to grep occurs, the rg process may still emit `close` events after grep has been spawned. Without this check, these stale events could incorrectly resolve the promise or cause race conditions.

#### Fix 5: setImmediate Fallback Scheduling (CODE-001)

**Line**: `src/tools/grep.ts:114`

Wrapped grep fallback spawn in `setImmediate()` to ensure state updates are visible before event handlers execute.

```typescript
// src/tools/grep.ts:114
setImmediate(() => runSearch('grep', grepArgs, 'grep'));
```

**Why this matters**: The `error` handler returns immediately after scheduling the fallback, ensuring the rg process's error handler completes before grep spawns. This makes the rg→grep transition deterministic and prevents stale events from the failed rg process from racing with grep events.

#### Fix 6: Helpful Error Message (CODE-004)

**Lines**: `src/tools/grep.ts:119-128`

Improved error message when neither ripgrep nor grep is installed to include installation guidance.

```typescript
finish({
  success: false,
  error: 'Neither ripgrep (rg) nor grep is installed.\n\n' +
    'Install ripgrep for best results:\n' +
    '  - macOS: brew install ripgrep\n' +
    '  - Ubuntu/Debian: apt install ripgrep\n' +
    '  - Windows: choco install ripgrep\n' +
    '  - Or visit: https://github.com/BurntSushi/ripgrep#installation',
});
```

**Before**: Generic "command not found" error
**After**: Clear message with platform-specific installation instructions

---

### 2. tests/unit/grep-tool.test.ts - Async Test Sequencing

#### Fix: Flaky Mocked Fallback Tests

**Issue**: Tests were emitting mock process events (`error`, `close`) before the async validation/spawn logic had completed, causing timeouts and incorrect assertions about stale event handling.

**Solution**: Added `flushImmediate()` helper and await points to properly sequence async operations.

```typescript
// Helper to flush setImmediate queue
const flushImmediate = () => new Promise<void>((resolve) => setImmediate(resolve));

// In tests - proper sequencing
const resultPromise = tool.execute({ pattern: 'test', path: '/tmp' });

// Wait for async validation + spawn('rg') to complete
await flushImmediate();

// Trigger ENOENT error from rg to initiate fallback
const rgError = new Error('spawn rg ENOENT') as NodeJS.ErrnoException;
rgError.code = 'ENOENT';
rgProc?.emit('error', rgError);

// Wait for setImmediate() to schedule spawn('grep')
await flushImmediate();

// Now safe to emit events on the grep process
grepProc?.emit('error', grepError);
const result = await resultPromise;
```

**Tests Fixed** (mocked fallback suite):
- `'shows helpful error when both tools are missing'`
- `'includes fallback prefix on error paths'`
- `'ignores stale events from the initial rg process'`

**Why this matters**: The production code uses `setImmediate()` to defer grep spawning (line 114). Tests must respect this timing by awaiting ticks between event emissions to accurately verify the fallback behavior and stale event handling.

---

### 3. tests/unit/path-validator.test.ts - Vitest Watch Mode Fix

#### Fix: ELOOP Error in Watch Mode

**Issue**: Circular symlink test fixtures created under `process.cwd()` caused Vitest's file watcher to encounter `ELOOP: too many symbolic links encountered` errors, crashing the watch mode.

**Solution**: Moved fixture directory from `process.cwd()` to `os.homedir()`.

**Fixture Creation** (beforeAll):

```typescript
beforeAll(async () => {
  // Create temp directory for test fixtures
  // Use $HOME instead of process.cwd() to avoid Vitest file watcher traversing
  // circular symlinks and throwing ELOOP errors in DEV watch mode.
  // The path validator allows both cwd and home directories.
  const homeDir = os.homedir();
  tempDir = await fs.mkdtemp(path.join(homeDir, '.tmp-path-validator-test-'));
  console.log(`Test fixtures directory: ${tempDir}`);
});
```

**Uses**: `os.homedir()` (user's home directory, e.g., `/home/user`)
**Prefix**: `.tmp-path-validator-test-`

**Why this matters**: Vitest watches the project directory (`process.cwd()`) for file changes. When circular symlinks exist in watched directories, the file system traversal fails with ELOOP. Moving fixtures to `$HOME` places them outside the watched directory tree.

#### Cleanup

**Automatic cleanup** (afterAll):
```typescript
afterAll(async () => {
  // Cleanup temp directory
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(`Cleaned up test fixtures directory: ${tempDir}`);
  } catch (err) {
    console.warn(`Warning: Failed to cleanup ${tempDir}:`, err);
  }
});
```

**Manual cleanup if tests interrupted**:
```bash
rm -rf "$HOME"/.tmp-path-validator-test-*
```

**Reference**: https://github.com/vitest-dev/vitest/issues/2821

---

## Test Results

### Test Count Verification

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/unit/app-state-debug.test.ts` | 8 | PASS (existing) |
| `tests/unit/grep-tool.test.ts` | 25 | PASS (new) |
| `tests/unit/path-validator.test.ts` | 35 | PASS (new) |
| **Total** | **68** | **ALL PASS** |

### Full Test Output

```
 Test Files  3 passed (3)
      Tests  68 passed (68)
   Duration  2.26s
```

---

## Verification Commands

### Run all tests (CI mode)

```bash
npm test -- --run
```

**Expected Result**:
```
 Test Files  3 passed (3)
      Tests  68 passed (68)
```

### Run in watch mode

```bash
npm test
```

**Expected Result**: Watch mode starts successfully without errors.

### Run specific test file

```bash
npm test -- --run tests/unit/grep-tool.test.ts
npm test -- --run tests/unit/path-validator.test.ts
```

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/tools/grep.ts` | Production | Pattern injection prevention, race condition fixes, improved errors |
| `tests/unit/grep-tool.test.ts` | Test | Comprehensive grep tool test coverage (25 tests) |
| `tests/unit/path-validator.test.ts` | Test | Path validation test coverage (35 tests) |

---

## Implementation Details by Fix ID

| Fix ID | Severity | Component | Line(s) | Description |
|--------|----------|-----------|---------|-------------|
| CODE-003 | MEDIUM | grep.ts | 66, 72 | `--` separator for rg and grep args |
| CODE-001 | HIGH | grep.ts | 76-79, 81-86 | Consolidated state + finish() gate |
| CODE-002 | HIGH | grep.ts | 98, 110 | Stale event checks |
| CODE-001 | HIGH | grep.ts | 114 | setImmediate for deterministic fallback |
| CODE-004 | MEDIUM | grep.ts | 119-128 | Installation instructions when both tools missing |

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `npm test -- --run` passes 68/68 tests | ✅ VERIFIED |
| `npm test` watch mode runs without errors | ✅ VERIFIED |
| All 5 grep.ts fixes implemented with correct line numbers | ✅ VERIFIED |
| Documentation matches current implementation | ✅ VERIFIED |

---

**Document Generated**: 2026-01-12
**Implementation Verified**: 2026-01-12
**All Acceptance Criteria**: MET
