# PRP: Address GPT-5 Pro Review Findings for PR #1

**PRP ID**: PRP-2026-002
**Target PR**: https://github.com/airplne/grok-cli/pull/1
**Branch**: `fix/grep-security-code-quality`
**Goal**: Address GPT-5 Pro review findings to achieve **GO** status for merge
**Date**: 2026-01-12

---

## Executive Summary

GPT-5 Pro reviewed PR #1 and returned **NO-GO** with 5 findings (1 HIGH, 2 MEDIUM, 2 LOW). After verifying each finding against the actual codebase on branch `fix/grep-security-code-quality`, the results are:

| Finding | Severity | Status | Action Required |
|---------|----------|--------|-----------------|
| #1 - Home directory cleanup risk | HIGH | **VALID** | Add strengthened safety guards |
| #2 - .env template allowlist | MEDIUM | **FALSE POSITIVE** | Already implemented |
| #3 - Symlink tests cross-platform | MEDIUM | **VALID** | Gate all symlink call sites + skip Unix-only tests on Windows |
| #4 - Doc line number drift | LOW | **FALSE POSITIVE** | All accurate |
| #5 - Dash-pattern test coverage | LOW | **PARTIAL GAP** | Add spawn args assertion |

**Scope**: Fix findings #1, #3, and #5. Document why #2 and #4 are already correct.

**Estimated Effort**: 3-4 hours

---

## Current State Verification

### Files on PR Branch

```
M  src/security/path-validator.ts (ENV patterns implemented)
M  src/tools/grep.ts (-- separator at lines 66, 72)
A  tests/unit/grep-tool.test.ts (25 tests, includes dash-pattern functional tests)
A  tests/unit/path-validator.test.ts (35 tests, EPERM/EACCES handling present)
A  docs/PRP-SECURITY-CODE-QUALITY-FIXES.md
A  docs/PR-CODEX-FIXES-IMPLEMENTATION.md
```

### Test Results

```
 Test Files  3 passed (3)
      Tests  68 passed (68)
   Duration  2.26s
```

---

## Finding #1: Home Directory Cleanup Risk (HIGH) - VALID

### Current Code

**File**: `tests/unit/path-validator.test.ts`

**Lines 34-35** (fixture creation):
```typescript
const homeDir = os.homedir();
tempDir = await fs.mkdtemp(path.join(homeDir, '.tmp-path-validator-test-'));
```

**Line 42** (cleanup):
```typescript
await fs.rm(tempDir, { recursive: true, force: true });
```

### Risk Analysis

**What could go wrong**:
1. If `fs.mkdtemp()` fails silently and `tempDir` becomes `undefined` or empty string
2. If `path.join()` produces unexpected result (e.g., just `homeDir` without suffix)
3. `fs.rm(homeDir, { recursive: true, force: true })` would delete entire home directory

**Likelihood**: LOW (mkdtemp is reliable), but **Impact**: CATASTROPHIC (total data loss)

### Required Fix (Strengthened Guards)

Add hardened safety guards before deletion:

```typescript
afterAll(async () => {
  // Safety guards before cleanup
  if (!tempDir) {
    console.warn('tempDir is undefined, skipping cleanup');
    return;
  }

  const homeDir = os.homedir();

  // Guard 1: Verify basename starts with expected prefix
  const basename = path.basename(tempDir);
  if (!basename.startsWith('.tmp-path-validator-test-')) {
    throw new Error(`SAFETY: tempDir basename missing prefix: ${basename}`);
  }

  // Guard 2: Never delete home directory itself
  if (tempDir === homeDir) {
    throw new Error('SAFETY: Refusing to delete home directory');
  }

  // Guard 3: Resolve real path and verify it's under home
  const realTempDir = await fs.realpath(tempDir);
  const realHomeDir = await fs.realpath(homeDir);

  if (realTempDir === realHomeDir) {
    throw new Error('SAFETY: Resolved tempDir is home directory');
  }

  // Guard 4: Verify resolved path is under home directory
  const relativePath = path.relative(realHomeDir, realTempDir);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`SAFETY: tempDir not under home: ${realTempDir}`);
  }

  // All guards passed - safe to delete
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(`Cleaned up test fixtures directory: ${tempDir}`);
  } catch (err) {
    console.warn(`Warning: Failed to cleanup ${tempDir}:`, err);
  }
});
```

**Key Improvements**:
- Uses `path.basename()` to verify the directory name itself (not just substring match)
- Uses `fs.realpath()` to resolve symlinks before comparison (prevents symlink attacks)
- Four independent guards, each with specific error message

### Acceptance Criteria

- [ ] Guard 1: Basename starts with `.tmp-path-validator-test-` (not just substring match)
- [ ] Guard 2: `tempDir !== homeDir` (exact match check)
- [ ] Guard 3: `realpath(tempDir) !== realpath(homeDir)` (symlink-resistant)
- [ ] Guard 4: Resolved path is under home directory (relative path check)
- [ ] Tests still pass: `npm test tests/unit/path-validator.test.ts`

---

## Finding #2: .env Template Allowlist (MEDIUM) - FALSE POSITIVE

### Current Code

**File**: `src/security/path-validator.ts`

**Lines 22-23** (patterns):
```typescript
const ENV_BLOCK_PATTERN = /\.env(?:\.|$)/i;
const ENV_DOC_ALLOW_PATTERN = /\.env\.(example|sample|template)$/i;
```

**Lines 227-230** (operation-aware allowlist):
```typescript
const allowEnvDocs =
  operation === 'read' && ENV_DOC_ALLOW_PATTERN.test(resolvedPath);
for (const pattern of BLOCKED_PATTERNS) {
  if (pattern === ENV_BLOCK_PATTERN && allowEnvDocs) {
    continue;  // Skip blocking if it's a read operation on a doc template
  }
```

### Verification

**What happens when reading `.env.example`?**
1. `ENV_BLOCK_PATTERN.test('.env.example')` → `true` (matches block pattern)
2. `ENV_DOC_ALLOW_PATTERN.test('.env.example')` → `true` (matches allow pattern)
3. `operation === 'read'` → `true`
4. `allowEnvDocs` → `true`
5. Block is **skipped** → Access **allowed**

**What happens when writing `.env.example`?**
1. `operation === 'write'` → `allowEnvDocs` → `false`
2. Block is **NOT skipped** → Access **denied**

### Conclusion

**Status**: ALREADY IMPLEMENTED CORRECTLY

The allowlist is:
- ✅ Operation-aware (`operation === 'read'`)
- ✅ Permits `.env.example`, `.env.sample`, `.env.template` for read
- ✅ Blocks all `.env*` files for write (including templates)
- ✅ Blocks real `.env` files for both read and write

**No changes required.**

---

## Finding #3: Windows / Platform Compatibility for Symlink Tests (MEDIUM) - ✅ VALID

### Current State (verified)

`tests/unit/path-validator.test.ts` creates symlinks in multiple tests via `fs.symlink(...)`. Some call sites are guarded (skip on `EPERM`/`EACCES`), but several are unguarded, and a few only handle `ELOOP`/`EEXIST`. This can break Windows and other environments where symlink creation is restricted.

Current symlink call sites (from `rg -n "fs.symlink\\(" tests/unit/path-validator.test.ts`):

| Line | Context (test name) | Guarded today? | Notes |
|------|----------------------|---------------|-------|
| 64 | Symlink Resolution: "should block symlink pointing to .env file" | ❌ NO | `await fs.symlink(...)` unguarded |
| 88 | Symlink Resolution: "should block symlink pointing to .env even with different name" | ❌ NO | unguarded |
| 150 | .env.example Allowlist: "should allow symlink to .env.example for read operations" | ❌ NO | unguarded |
| 166 | .env.example Allowlist: "should block symlink to .env.example for write operations" | ❌ NO | unguarded |
| 186 | Blocked Absolute Paths: "should block symlink to /etc/passwd" | ⚠️ PARTIAL | skips on EPERM/EACCES only; still Unix-specific |
| 214 | Blocked Absolute Paths: "should block symlink to /etc/shadow" | ⚠️ PARTIAL | skips on EPERM/EACCES only; still Unix-specific |
| 322 | Write Operation Symlink Protection: "should block write operations to symlinks" | ❌ NO | unguarded |
| 360/361 | Circular Symlink Detection: "should detect and block circular symlinks" | ⚠️ PARTIAL | handles `ELOOP` only; does not handle EPERM/EACCES |
| 391 | Circular Symlink Detection: "should detect self-referencing symlink" | ⚠️ PARTIAL | handles `EEXIST`/`ELOOP`; does not handle EPERM/EACCES |
| 451 | Blocked Patterns: "should block symlink to .ssh directory" | ❌ NO | unguarded |

Also, `Blocked Absolute Paths` contains Unix-only direct path tests (`/etc/passwd`, `/proc/self/environ`) that are not meaningful on Windows and should be skipped there.

### Required Fix

Make the suite pass on Windows / restricted environments by:
1) Skipping symlink-dependent tests when symlinks cannot be created
2) Skipping Unix-only absolute path tests on Windows

#### Implementation approach (works with Vitest test-definition timing)

Do NOT attempt to decide skips based on values computed in `beforeAll`. Vitest registers tests at module-evaluation time, so platform/capability flags used for skipping must be available synchronously when the file is imported.

**Add synchronous symlink capability detection at module scope** (use `fs` sync APIs; keep it isolated under `os.tmpdir()`):

```typescript
const IS_WINDOWS = process.platform === 'win32';

function detectSymlinkCapability(): boolean {
  const linkPath = path.join(
    os.tmpdir(),
    `.grok-cli-symlink-capability-${process.pid}-${Date.now()}`
  );

  try {
    // `type` is mainly relevant on Windows; ignored on POSIX.
    fsSync.symlinkSync(os.tmpdir(), linkPath, 'dir');
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') return false;
    // Treat unknown errors as "no symlink capability" to keep the suite robust.
    return false;
  } finally {
    try {
      fsSync.unlinkSync(linkPath);
    } catch {
      // Ignore cleanup errors if the link was never created.
    }
  }
}

const CAN_CREATE_SYMLINKS = detectSymlinkCapability();

const describeSymlink = CAN_CREATE_SYMLINKS ? describe : describe.skip;
const itSymlink = CAN_CREATE_SYMLINKS ? it : it.skip;

const describeUnixOnly = IS_WINDOWS ? describe.skip : describe;
const itUnixOnly = IS_WINDOWS ? it.skip : it;
const itUnixSymlinkOnly = !IS_WINDOWS && CAN_CREATE_SYMLINKS ? it : it.skip;
```

**Apply the wrappers to all symlink-creating tests**:
- Use `describeSymlink(...)` for the entire `Symlink Resolution` and `Circular Symlink Detection` blocks.
- In `.env.example Allowlist`, keep the non-symlink tests (`.env.example/.sample/.template` read + `.env.example` write) always running, but change the two symlink tests to `itSymlink(...)`.
- Change `Write Operation Symlink Protection` → "should block write operations to symlinks" to `itSymlink(...)`.
- Change `Blocked Patterns` → "should block symlink to .ssh directory" to `itSymlink(...)`.
- In `Blocked Absolute Paths`:
  - Change the two `/etc/*` symlink tests to `itUnixSymlinkOnly(...)` (or gate them at the top of the test with `if (IS_WINDOWS || !CAN_CREATE_SYMLINKS) return`).
  - Change the two direct-path tests (`/etc/passwd`, `/proc/self/environ`) to `itUnixOnly(...)`.

### Acceptance Criteria

- [ ] On Linux/macOS: `npm test tests/unit/path-validator.test.ts` passes with no unexpected skips.
- [ ] On Windows without symlink permissions: the suite passes; symlink-dependent tests are skipped (no hard failures from `EPERM`/`EACCES`).
- [ ] Unix-only tests (`/etc/*`, `/proc/*`) are skipped on Windows.

---

## Finding #4: Doc Line Numbers (LOW) - FALSE POSITIVE

### Verification Results

Compared `docs/PR-CODEX-FIXES-IMPLEMENTATION.md` against `nl -ba src/tools/grep.ts`:

| Reference | Documented | Actual | Match |
|-----------|------------|--------|-------|
| -- separator (rg) | 66 | 66 | ✅ |
| -- separator (grep) | 72 | 72 | ✅ |
| State object | 76-79 | 76-79 | ✅ |
| finish() gate | 81-86 | 81-86 | ✅ |
| Stale check (close) | 98 | 98 | ✅ |
| Stale check (error) | 110 | 110 | ✅ |
| setImmediate | 114 | 114 | ✅ |
| Error message | 119-128 | 119-128 | ✅ |

### Conclusion

**Status**: ALL LINE NUMBERS ACCURATE

**No changes required.**

---

## Finding #5: Dash-Pattern Test Coverage (LOW) - PARTIAL GAP

### Current Test Coverage

**File**: `tests/unit/grep-tool.test.ts`

**Functional tests exist**:

**Lines 39-47** - Tests pattern starting with `-`:
```typescript
it('should handle patterns starting with single dash', async () => {
  const result = await grepTool.execute({
    pattern: '-debug',
    path: tempDir,
  });
  expect(result.success).toBe(true);
  expect(result.output).toContain('-debug-flag');
});
```

**Lines 49-56** - Tests pattern starting with `--`:
```typescript
it('should handle patterns starting with double dash', async () => {
  const result = await grepTool.execute({
    pattern: '--double',
    path: tempDir,
  });
  expect(result.success).toBe(true);
  expect(result.output).toContain('--double-dash');
});
```

### Gap Identified

**What's missing**: No test ASSERTS that the `--` separator is present in spawn args.

**Risk**: Refactoring could accidentally remove the `--` separator from lines 66/72 without test failure, since the functional tests only verify end-to-end behavior.

### Required Fix

Add regression test that explicitly verifies spawn arguments:

**Add to `tests/unit/grep-tool.test.ts` in "Fallback Behavior (mocked)" section**:

```typescript
it('should include -- separator in spawn args to prevent pattern injection', async () => {
  const tool = new GrepToolMocked();
  const resultPromise = tool.execute({ pattern: '-malicious-pattern', path: '/tmp' });

  await flushImmediate();

  // Verify rg was called with -- separator before pattern
  const rgSpawnArgs = spawnMock.mock.calls[0][1];
  const dashDashIndex = rgSpawnArgs.indexOf('--');
  const patternIndex = rgSpawnArgs.indexOf('-malicious-pattern');

  expect(dashDashIndex).toBeGreaterThan(-1);
  expect(patternIndex).toBeGreaterThan(dashDashIndex);
  expect(rgSpawnArgs[dashDashIndex + 1]).toBe('-malicious-pattern');

  // Trigger fallback to grep
  const rgError = new Error('spawn rg ENOENT') as NodeJS.ErrnoException;
  rgError.code = 'ENOENT';
  rgProc?.emit('error', rgError);

  await flushImmediate();

  // Verify grep was also called with -- separator before pattern
  const grepSpawnArgs = spawnMock.mock.calls[1][1];
  const grepDashDashIndex = grepSpawnArgs.indexOf('--');
  const grepPatternIndex = grepSpawnArgs.indexOf('-malicious-pattern');

  expect(grepDashDashIndex).toBeGreaterThan(-1);
  expect(grepPatternIndex).toBeGreaterThan(grepDashDashIndex);
  expect(grepSpawnArgs[grepDashDashIndex + 1]).toBe('-malicious-pattern');

  grepProc?.emit('close', 1);
  await resultPromise;
});
```

### Acceptance Criteria

- [ ] New test added to mocked fallback section
- [ ] Test verifies `--` separator for BOTH rg and grep
- [ ] Test uses dash-prefixed pattern to demonstrate protection
- [ ] Test count increases from 68 to 69
- [ ] `npm test` passes

---

## Implementation Plan

### Step 1: Fix Finding #1 (HIGH) - Strengthened Safety Guards

**File**: `tests/unit/path-validator.test.ts`

**Location**: afterAll block (lines 39-47)

**Change**:
```diff
   afterAll(async () => {
-    // Cleanup temp directory
+    // Safety guards before cleanup
+    if (!tempDir) {
+      console.warn('tempDir is undefined, skipping cleanup');
+      return;
+    }
+
+    const homeDir = os.homedir();
+
+    // Guard 1: Verify basename starts with expected prefix
+    const basename = path.basename(tempDir);
+    if (!basename.startsWith('.tmp-path-validator-test-')) {
+      throw new Error(`SAFETY: tempDir basename missing prefix: ${basename}`);
+    }
+
+    // Guard 2: Never delete home directory itself
+    if (tempDir === homeDir) {
+      throw new Error('SAFETY: Refusing to delete home directory');
+    }
+
+    // Guard 3: Resolve real paths and ensure tempDir is not (or under) home incorrectly
+    const realTempDir = await fs.realpath(tempDir);
+    const realHomeDir = await fs.realpath(homeDir);
+
+    if (realTempDir === realHomeDir) {
+      throw new Error('SAFETY: Resolved tempDir is home directory');
+    }
+
+    // Guard 4: Verify resolved tempDir is under resolved home directory
+    const relativePath = path.relative(realHomeDir, realTempDir);
+    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
+      throw new Error(`SAFETY: tempDir not under home: ${realTempDir}`);
+    }
+
+    // All guards passed - safe to delete
     try {
       await fs.rm(tempDir, { recursive: true, force: true });
```

### Step 2: Fix Finding #3 (MEDIUM) - Symlink Tests Cross-Platform

**File**: `tests/unit/path-validator.test.ts`

**Goal**: Ensure the suite passes on Windows and in environments that cannot create symlinks by skipping symlink-dependent tests (and skipping Unix-only absolute-path tests on Windows).

**Important**: Do not rely on values computed in `beforeAll` to decide skips. Vitest registers tests at module-evaluation time.

**Changes**:

1. Add module-scope capability flags + helpers (place after imports, before the top-level `describe(...)`):

```typescript
const IS_WINDOWS = process.platform === 'win32';

function detectSymlinkCapability(): boolean {
  const linkPath = path.join(
    os.tmpdir(),
    `.grok-cli-symlink-capability-${process.pid}-${Date.now()}`
  );

  try {
    fsSync.symlinkSync(os.tmpdir(), linkPath, 'dir');
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') return false;
    return false;
  } finally {
    try {
      fsSync.unlinkSync(linkPath);
    } catch {
      // ignore
    }
  }
}

const CAN_CREATE_SYMLINKS = detectSymlinkCapability();

const describeSymlink = CAN_CREATE_SYMLINKS ? describe : describe.skip;
const itSymlink = CAN_CREATE_SYMLINKS ? it : it.skip;

const describeUnixOnly = IS_WINDOWS ? describe.skip : describe;
const itUnixOnly = IS_WINDOWS ? it.skip : it;
const itUnixSymlinkOnly = !IS_WINDOWS && CAN_CREATE_SYMLINKS ? it : it.skip;
```

2. Apply the helpers to every `fs.symlink(...)` call site:

- Change `describe('Symlink Resolution', ...)` → `describeSymlink('Symlink Resolution', ...)`
- Change the two symlink tests inside `.env.example Allowlist`:
  - `it('should allow symlink to .env.example for read operations', ...)` → `itSymlink(...)`
  - `it('should block symlink to .env.example for write operations', ...)` → `itSymlink(...)`
- In `Blocked Absolute Paths`:
  - Change `/etc/*` symlink tests to `itUnixSymlinkOnly(...)` (or add an early-return guard).
  - Change the direct-path tests (`/etc/passwd`, `/proc/self/environ`) to `itUnixOnly(...)`.
- Change `it('should block write operations to symlinks', ...)` → `itSymlink(...)`
- Change `describe('Circular Symlink Detection', ...)` → `describeSymlink('Circular Symlink Detection', ...)`
- Change `it('should block symlink to .ssh directory', ...)` → `itSymlink(...)`

3. Final audit: run `rg -n "fs.symlink\\(" tests/unit/path-validator.test.ts` and confirm every occurrence is within a `describeSymlink`/`itSymlink`/`itUnixSymlinkOnly` test or has a local `try/catch` that handles `EPERM`/`EACCES`.

**Acceptance Criteria**:
- [ ] On Linux/macOS: `npm test tests/unit/path-validator.test.ts` passes with no unexpected skips.
- [ ] On Windows without symlink permissions: the suite passes; symlink-dependent tests are skipped (no hard failures from `EPERM`/`EACCES`).
- [ ] Unix-only tests (`/etc/*`, `/proc/*`) are skipped on Windows.

### Step 3: Fix Finding #5 (LOW) - Spawn Args Assertion

**File**: `tests/unit/grep-tool.test.ts`

**Location**: After line 388 (end of "Fallback Behavior (mocked)" section)

**Add new test**:
```typescript
it('verifies -- separator in spawn args prevents pattern injection', async () => {
  const tool = new GrepToolMocked();
  const resultPromise = tool.execute({ pattern: '-malicious', path: '/tmp' });

  await flushImmediate();

  // Verify rg args include -- before pattern
  const rgArgs = spawnMock.mock.calls[0][1];
  const rgDashIndex = rgArgs.indexOf('--');
  const rgPatIndex = rgArgs.indexOf('-malicious');
  expect(rgDashIndex).toBeGreaterThan(-1);
  expect(rgPatIndex).toEqual(rgDashIndex + 1);

  // Trigger fallback
  const rgError = new Error('spawn rg ENOENT') as NodeJS.ErrnoException;
  rgError.code = 'ENOENT';
  rgProc?.emit('error', rgError);
  await flushImmediate();

  // Verify grep args include -- before pattern
  const grepArgs = spawnMock.mock.calls[1][1];
  const grepDashIndex = grepArgs.indexOf('--');
  const grepPatIndex = grepArgs.indexOf('-malicious');
  expect(grepDashIndex).toBeGreaterThan(-1);
  expect(grepPatIndex).toEqual(grepDashIndex + 1);

  grepProc?.emit('close', 1);
  await resultPromise;
});
```

### Step 4: Update Documentation

**File**: `docs/PR-CODEX-FIXES-IMPLEMENTATION.md`

Update test count from 68 to 69:

**Line 223**:
```diff
- | **Total** | **68** | **ALL PASS** |
+ | **Total** | **69** | **ALL PASS** |
```

**Line 228**:
```diff
-  Tests  68 passed (68)
+  Tests  69 passed (69)
```

**Line 246**:
```diff
-      Tests  68 passed (68)
+      Tests  69 passed (69)
```

**Line 292**:
```diff
- | `npm test` passes 68/68 tests | ✅ VERIFIED |
+ | `npm test` passes 69/69 tests | ✅ VERIFIED |
```

---

## Safety Requirements (Finding #1)

### Hard Guardrails

| Guard | Purpose | Failure Mode |
|-------|---------|--------------|
| `if (!tempDir)` | Prevent undefined deletion | Skip cleanup, log warning |
| `basename.startsWith('.tmp-path-validator-test-')` | Ensure we're deleting only a test-created directory | Throw error, fail suite |
| `if (tempDir === homeDir)` | Never delete home itself | Throw error, fail test suite |
| `realpath(tempDir) !== realpath(homeDir)` | Prevent deleting home via symlink tricks | Throw error, fail suite |
| `path.relative(realHomeDir, realTempDir)` containment check | Ensure deletion target is under `$HOME` | Throw error, fail suite |

### Acceptance Checks

Before merging, verify:
```bash
# Simulate tempDir corruption (guards should trigger)
node -e "
const path = require('path');
const os = require('os');
const tempDir = os.homedir(); // Malicious: set to home
const homeDir = os.homedir();

const basename = path.basename(tempDir);
if (!basename.startsWith('.tmp-path-validator-test-')) {
  console.log('PASS: basename prefix guard would block deletion');
}

if (tempDir === homeDir) {
  console.log('PASS: home directory guard would block deletion');
}
"
```

---

## Cross-Platform Strategy (Finding #3)

### Goal

Ensure the unit test suite is reliable across environments:
- Linux/macOS: run all tests (no unexpected skips)
- Windows / restricted environments: symlink-dependent tests do not hard-fail (they are skipped instead)

### Standard

- Any test that calls `fs.symlink(...)` must be behind `itSymlink` / `describeSymlink` (or have explicit `EPERM`/`EACCES` handling).
- Any test that depends on Unix-only absolute paths (`/etc/*`, `/proc/*`) must be behind `itUnixOnly`.
- Any test that needs both (Unix-only paths + symlink creation) must be behind `itUnixSymlinkOnly`.

### Implementation Note

Vitest registers tests at module-evaluation time, so the flags that control skipping (`IS_WINDOWS`, `CAN_CREATE_SYMLINKS`) must be computed synchronously at module scope. Do not compute them in `beforeAll`.

---

## Verification Commands

### After Implementing Fixes

```bash
# Run all tests
npm test

# Expected (Linux/macOS)
 Test Files  3 passed (3)
      Tests  69 passed (69)

# Expected (Windows / restricted symlink env)
# - Exit code 0
# - Some symlink and Unix-only tests are skipped
#   Tests  <passed> passed | <skipped> skipped (69)
```

### Run specific test file

```bash
npm test tests/unit/path-validator.test.ts
npm test tests/unit/grep-tool.test.ts
```

### Test watch mode (verify no ELOOP)

```bash
npm test
```

### Verify safety guards

- Confirm `tests/unit/path-validator.test.ts` `afterAll` includes the basename + realpath containment checks before calling `fs.rm`.
- Run the Safety Requirements > Acceptance Checks snippet above (guards should trigger).

---

## Documentation Update Checklist

After implementing fixes:

- [ ] Update test count in `docs/PR-CODEX-FIXES-IMPLEMENTATION.md`:
  - Line 223: Change 68 to 69
  - Line 228: Change 68 to 69
  - Line 246: Change 68 to 69
  - Line 292: Change 68/68 to 69/69

- [ ] Verify all line numbers still accurate (they should be, no code changes to grep.ts)

- [ ] Add note about safety guards in path-validator test section

---

## Definition of Done

### Acceptance Criteria

| Criterion | Verification Method | Status |
|-----------|---------------------|--------|
| No home directory data loss risk | Guards prevent deletion | ⏳ TODO |
| Windows doesn't hard-fail on symlinks | Symlink tests are gated/skipped when unsupported | ⏳ TODO |
| Dash-pattern regression test present | Spawn args assertion exists | ⏳ TODO |
| Docs synchronized to code | Test counts updated | ⏳ TODO |
| PR #1 updated with only intended files | git show c12907a | ✅ DONE |

### Final Verification

```bash
# All tests pass
npm test
# Expected (Linux/macOS): 3 files, 69 tests passing
# Expected (Windows / restricted symlink env): exit code 0; some tests skipped

# Watch mode works
npm test
# Expect: No ELOOP crash

# PR contains only 6 files
git show --name-only c12907a
# Expect: 6 files listed above
```

---

## Files to Modify

| File | Change | Lines Affected |
|------|--------|----------------|
| `tests/unit/path-validator.test.ts` | Add safety guards + add module-scope symlink gating helpers + apply to all `fs.symlink(...)` call sites + gate Unix-only tests | imports section + beforeAll/afterAll + multiple tests/blocks |
| `tests/unit/grep-tool.test.ts` | Add spawn args test | After line 388 |
| `docs/PR-CODEX-FIXES-IMPLEMENTATION.md` | Update test count 68→69 | 223, 228, 246, 292 |

---

## Estimated Effort

| Task | Time |
|------|------|
| Add strengthened safety guards (Finding #1) | 45 min |
| Add symlink gating + Unix-only skips (Finding #3) | 60 min |
| Add spawn args test (Finding #5) | 30 min |
| Update documentation | 15 min |
| Verification & testing | 60 min |
| **Total** | **3 hours** |

---

## Summary for GPT-5 Pro Re-Review

After implementing the fixes in this PRP:

**Findings Addressed**:
- ✅ #1 (HIGH): Strengthened safety guards with basename + realpath checks
- ✅ #2 (MEDIUM): Documented as already implemented correctly (ENV_DOC_ALLOW_PATTERN)
- ✅ #3 (MEDIUM): Gated all symlink-dependent tests (and Unix-only path tests) for cross-platform reliability
- ✅ #4 (LOW): Verified all line numbers accurate (no changes needed)
- ✅ #5 (LOW): Added spawn args assertion test for -- separator

**Updated metrics**:
- Test count: 69 (was 68)
- Files changed: Still 6
- All tests passing
- All CRITICAL/HIGH items resolved

**Expected GPT-5 Pro decision**: **GO** for merge

---

**End of PRP**

*Generated by Claude Sonnet 4.5 - 2026-01-12*
