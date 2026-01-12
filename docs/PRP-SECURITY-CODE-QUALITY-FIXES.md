# PRP: Security & Code Quality Fixes for grok-cli

**Document ID**: PRP-2025-001
**Version**: 1.0
**Status**: READY FOR REVIEW
**Author**: Opus Subagent Team
**Created**: 2025-01-11
**Target Audience**: Claude/Codex Development Team

---

## Executive Summary

### Overview

This PRP covers a small set of follow-up hardening tasks after the recent `.env.example` read-only allowance and `rg` → `grep` fallback work. The focus is on grep behavior correctness and adding regression tests for path validation. No new features are introduced.

### Risk Assessment

| Severity | Count | Issues |
|----------|-------|--------|
| **HIGH** | 2 | Grep fallback state handling (CODE-001), fallback resource cleanup (CODE-002) |
| **MEDIUM** | 2 | Missing `--` separator (CODE-003), missing-tool error message (CODE-004) |
| **LOW** | 1 | Symlink protection regression tests (SEC-001) |

### Estimated Effort

| Category | Effort | Notes |
|----------|--------|-------|
| Grep fixes | 2-3 hours | CODE-001/002/003/004 |
| Tests & verification | 1-2 hours | Path validator + grep tests |
| **Total** | **3-6 hours** | Single developer estimate |

### Recommendation

> **Proceed with focused fixes** — The grep tool improvements are user-visible reliability fixes, and the symlink tests guard against regressions in existing protections.

---

## Background & Context

### Recent Codex Team Contributions

#### 1. `.env.example` Read-Only Access (`path-validator.ts`)

**Purpose**: Allow CLI to read `.env.example`/`.env.sample`/`.env.template` files for configuration reference while blocking actual `.env` files.

**Implementation**:
```typescript
const ENV_BLOCK_PATTERN = /\.env(?:\.|$)/i;
const ENV_DOC_ALLOW_PATTERN = /\.env\.(example|sample|template)$/i;

// Allow read-only for documentation env files
const allowEnvDocs = operation === 'read' && ENV_DOC_ALLOW_PATTERN.test(resolvedPath);
```

**Location**: `src/security/path-validator.ts`

#### 2. `rg` → `grep` Fallback (`grep.ts`)

**Purpose**: Ensure search functionality works on systems without `ripgrep` by falling back to `grep`.

**Implementation**:
- Primary: Use `rg` (ripgrep) when available
- Fallback: Use system `grep` when `rg` returns ENOENT
- User notification when fallback occurs

**Location**: `src/tools/grep.ts`

### Review Performed

| Aspect | Details |
|--------|---------|
| **Review Type** | Focused hardening review |
| **Reviewer** | Claude Opus (3 specialized subagents) |
| **Scope** | Grep tool correctness + path validation regression coverage |
| **Tests Added** | None yet (tests added by this PRP) |

---

## Findings Summary Table

| ID | Severity | Component | Issue | Status |
|----|----------|-----------|-------|--------|
| SEC-001 | LOW | `path-validator.ts` | Missing regression tests for symlink protections | **OPEN** |
| CODE-001 | **HIGH** | `grep.ts` | State handling in fallback path is fragile | **OPEN** |
| CODE-002 | **HIGH** | `grep.ts` | Fallback cleanup/ordering can leak events | **OPEN** |
| CODE-003 | MEDIUM | `grep.ts` | Missing `--` separator for patterns | **OPEN** |
| CODE-004 | MEDIUM | `grep.ts` | Cryptic error when both tools missing | **OPEN** |

---

## Scope

### In Scope (This PRP)

| ID | Reason |
|----|--------|
| **SEC-001** | Add regression tests for existing symlink protections |
| **CODE-001** | High-impact reliability issue |
| **CODE-002** | Resource leak risk in fallback path |
| **CODE-003** | User-facing bug with simple mitigation |
| **CODE-004** | Poor error UX, easy improvement |

### Out of Scope (Deferred)

| ID | Reason |
|----|--------|
| **SEC-002** | Shell bypass is architectural - requires separate sandboxing PRP |
| **SEC-003** | API contract discussion needed - recommend design review |

---

## SECTION A: Security Fixes

### SEC-001: Symlink Protection Regression Tests (LOW)

#### Goal

Lock in existing symlink protections with regression tests, especially after adding the `.env.example/.env.sample/.env.template` read-only allowlist. No production code changes are expected unless the allowlist is missing.

#### Current State

`path-validator.ts` already resolves symlinks via `fs.realpath()` and checks blocked patterns against the resolved path. The task is to add tests to prevent regressions and to verify the env-doc allowlist is read-only.

#### Required Tests (Add)

```typescript
describe('PathValidator - Symlink Security', () => {
  it('should block symlink pointing to .env file', async () => {
    // Setup: ln -s .env safe-config.txt
    const result = await validatePath('/project/safe-config.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('blocked pattern');
  });

  it('should allow symlink to .env.example for read operations', async () => {
    // Setup: ln -s .env.example sample.txt
    const result = await validatePath('/project/sample.txt', { operation: 'read' });
    expect(result.valid).toBe(true);
  });

  it('should block .env.example for write operations', async () => {
    // Setup: ln -s .env.example sample.txt
    const result = await validatePath('/project/sample.txt', { operation: 'write' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('blocked pattern');
  });

  it('should detect and block circular symlinks', async () => {
    // Setup: a -> b -> c -> a
    const result = await validatePath('/project/circular-a');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('circular symlink');
  });

  it('should block symlink to /etc/passwd', async () => {
    // Setup: ln -s /etc/passwd users.txt
    const result = await validatePath('/project/users.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('restricted system path');
  });
});
```

#### Notes

- TOCTOU remains mitigated by `validateAndOpen()` for read operations.
- Hard links remain a low-risk edge case and are out of scope.

---

## SECTION B: Grep Tool Fixes

### Files to Modify

- `/home/aip0rt/Desktop/grok-cli/src/tools/grep.ts`

### CODE-003: Missing `--` Separator (MEDIUM)

#### Problem

Patterns starting with `-` are misinterpreted as ripgrep flags.

```bash
# Fails: "unknown flag '-debug'"
grep -pattern "-debug" .

# Works: Pattern treated as literal
grep -- "-debug" .
```

#### Current Code (current implementation)

```typescript
rgArgs.push(pattern, validated.resolvedPath!);
```

#### Fix

```diff
- rgArgs.push(pattern, validated.resolvedPath!);
+ rgArgs.push('--', pattern, validated.resolvedPath!);
```

If grep arguments are constructed separately, ensure they also include `--`:

```diff
- grepArgs.push(pattern, validated.resolvedPath!);
+ grepArgs.push('--', pattern, validated.resolvedPath!);
```

---

### CODE-001 & CODE-002: Race Condition and Resource Leak (HIGH)

#### Problem

1. Two separate flags (`resolved` and per-call `active`) create non-atomic state
2. When rg fails and grep starts, stale listeners can still fire
3. Error handling is spread across branches, making correctness hard to reason about

#### Current Code Structure

```typescript
return new Promise((resolve) => {
  let resolved = false;

  const finish = (result) => {
    if (resolved) return;
    resolved = true;
    resolve(result);
  };

  const runSearch = (cmd, args, tool) => {
    let active = true;
    const proc = spawn(cmd, args, { cwd: process.cwd() });

    proc.on('close', (code) => {
      if (!active) return;
      finish(...);
    });

    proc.on('error', (err) => {
      if (tool === 'rg' && err.code === 'ENOENT') {
        active = false;
        runSearch('grep', grepArgs, 'grep');
      }
    });
  };
});
```

#### Fix: Consolidated State Object

```typescript
return new Promise((resolve) => {
  const state = {
    resolved: false,
    activeProcess: null as ChildProcess | null,
  };

  const finish = (result: ToolResult) => {
    if (state.resolved) return;
    state.resolved = true;
    state.activeProcess = null;
    resolve(result);
  };

  const runSearch = (command: string, args: string[], tool: 'rg' | 'grep') => {
    const proc = spawn(command, args, { cwd: process.cwd() });
    state.activeProcess = proc;  // Track active process
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (state.activeProcess !== proc) return;  // Ignore stale
      const prefix = tool === 'grep' ? 'Using grep fallback (rg not found).\n' : '';
      if (code === 0) {
        finish({ success: true, output: prefix + (stdout || 'No matches found.') });
      } else if (code === 1) {
        finish({ success: true, output: prefix + 'No matches found.' });
      } else {
        finish({ success: false, error: prefix + (stderr || 'Search failed') });
      }
    });

    proc.on('error', (err) => {
      if (state.activeProcess !== proc) return;  // Ignore stale

      if (tool === 'rg' && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        setImmediate(() => runSearch('grep', grepArgs, 'grep'));
        return;
      }

      // CODE-004 fix: Helpful error when both tools missing
      if (tool === 'grep' && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        finish({
          success: false,
          error: 'Neither ripgrep (rg) nor grep is installed.\n\n' +
            'Install ripgrep for best results:\n' +
            '  - macOS: brew install ripgrep\n' +
            '  - Ubuntu/Debian: apt install ripgrep\n' +
            '  - Windows: choco install ripgrep',
        });
        return;
      }

      const prefix = tool === 'grep' ? 'Using grep fallback (rg not found).\n' : '';
      finish({ success: false, error: prefix + (err.message || 'Search failed') });
    });
  };

  runSearch('rg', rgArgs, 'rg');
});
```

#### Key Improvements

| Issue | Solution |
|-------|----------|
| Race condition | Single `state` object, process identity check |
| Resource leak | `state.activeProcess` tracks current process, stale ignored |
| Missing prefix on errors | Added to all error paths |
| Cryptic ENOENT | Helpful installation instructions |

---

### CODE-004: Cryptic Error When Both Tools Missing (MEDIUM)

**Before:**
```
Error: spawn grep ENOENT
```

**After:**
```
Error: Neither ripgrep (rg) nor grep is installed.

Install ripgrep for best results:
  - macOS: brew install ripgrep
  - Ubuntu/Debian: apt install ripgrep
  - Windows: choco install ripgrep
```

---

## SECTION C: Complete Fixed grep.ts

```typescript
import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

function validateGrepPattern(pattern: string): { valid: true } | { valid: false; error: string } {
  if (/\\x(?![0-9a-fA-F]{2})/.test(pattern)) {
    return { valid: false, error: 'Incomplete hex escape (\\x must be followed by 2 hex digits)' };
  }
  if (/\\u(?![0-9a-fA-F]{4})/.test(pattern)) {
    return { valid: false, error: 'Incomplete Unicode escape (\\u must be followed by 4 hex digits)' };
  }
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid regex' };
  }
}

export class GrepTool extends BaseTool {
  name = 'Grep';
  description = 'Search for a pattern in files using ripgrep. Returns matching lines.';
  requiresConfirmation = false;

  parameters = z.object({
    pattern: z.string().describe('The regex pattern to search for'),
    path: z.string().optional().describe('File or directory to search in'),
    glob: z.string().optional().describe('File pattern to filter (e.g., "*.ts")'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, path: searchPath = '.', glob } = this.parameters.parse(args);

    try {
      const patternValidation = validateGrepPattern(pattern);
      if (!patternValidation.valid) {
        return { success: false, error: `Invalid pattern: ${patternValidation.error}` };
      }

      const validated = await validatePath(searchPath);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      const rgArgs = ['--line-number', '--color=never', '--no-heading'];
      if (glob) rgArgs.push('--glob', glob);
      rgArgs.push('--', pattern, validated.resolvedPath!);  // FIX: -- separator

      const grepArgs = ['-R', '-n'];
      if (glob) grepArgs.push('--include', glob);
      grepArgs.push('--', pattern, validated.resolvedPath!);

      return new Promise((resolve) => {
        const state = {
          resolved: false,
          activeProcess: null as ChildProcess | null,
        };

        const finish = (result: ToolResult) => {
          if (state.resolved) return;
          state.resolved = true;
          state.activeProcess = null;
          resolve(result);
        };

        const runSearch = (command: string, args: string[], tool: 'rg' | 'grep') => {
          const proc = spawn(command, args, { cwd: process.cwd() });
          state.activeProcess = proc;
          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', (data) => { stdout += data; });
          proc.stderr.on('data', (data) => { stderr += data; });

          proc.on('close', (code) => {
            if (state.activeProcess !== proc) return;
            const prefix = tool === 'grep' ? 'Using grep fallback (rg not found).\n' : '';
            if (code === 0) {
              finish({ success: true, output: prefix + (stdout || 'No matches found.') });
            } else if (code === 1) {
              finish({ success: true, output: prefix + 'No matches found.' });
            } else {
              finish({ success: false, error: prefix + (stderr || 'Search failed') });
            }
          });

          proc.on('error', (err) => {
            if (state.activeProcess !== proc) return;

            if (tool === 'rg' && (err as NodeJS.ErrnoException).code === 'ENOENT') {
              setImmediate(() => runSearch('grep', grepArgs, 'grep'));
              return;
            }

            if (tool === 'grep' && (err as NodeJS.ErrnoException).code === 'ENOENT') {
              finish({
                success: false,
                error: 'Neither ripgrep (rg) nor grep is installed.\n\n' +
                  'Install ripgrep for best results:\n' +
                  '  - macOS: brew install ripgrep\n' +
                  '  - Ubuntu/Debian: apt install ripgrep\n' +
                  '  - Windows: choco install ripgrep\n' +
                  '  - Or visit: https://github.com/BurntSushi/ripgrep#installation',
              });
              return;
            }

            const prefix = tool === 'grep' ? 'Using grep fallback (rg not found).\n' : '';
            finish({ success: false, error: prefix + (err.message || 'Search failed') });
          });
        };

        runSearch('rg', rgArgs, 'rg');
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }
}
```

---

## SECTION D: Test Coverage

### Existing Tests (Current Repo)

| File | Notes |
|------|-------|
| `tests/unit/app-state-debug.test.ts` | UI state regression harness |
| `tests/unit/secret-resolver.test.ts` | Secret resolver unit tests (unrelated) |

**Gap:** No existing tests cover `path-validator.ts` or the grep tool. This PRP adds those tests.

### Additional Tests Required

#### Symlink Security Tests (new: `tests/unit/path-validator.test.ts`)

```typescript
describe('Symlink Attack Prevention', () => {
  it('blocks symlink to .env');
  it('blocks nested symlinks to sensitive files');
  it('detects circular symlinks');
  it('blocks symlink to /etc/passwd');
  it('allows symlink to .env.example for read');
});
```

#### Grep Tool Tests (new: `tests/unit/grep-tool.test.ts`)

```typescript
describe('Grep Pattern Handling', () => {
  it('handles patterns starting with -');
  it('handles patterns starting with --');
});

describe('Grep Fallback', () => {
  it('shows helpful error when both tools missing');
  it('includes prefix on error paths');
  it('does not leak processes on fallback');
});
```

---

## SECTION E: Verification Plan

### Manual Testing Checklist

```markdown
## Pre-Fix Verification
- [ ] Confirm symlink to .env is blocked
- [ ] Confirm grep "-pattern" fails
- [ ] Confirm cryptic error when both tools missing

## Post-Fix Verification
- [ ] Symlink to .env remains blocked
- [ ] Symlink to .env.example is readable (read-only)
- [ ] `grok grep -- "-test"` works correctly
- [ ] Remove rg from PATH, grep fallback works
- [ ] Remove both tools, helpful error shown
- [ ] 100 concurrent grep calls succeed

## Regression Checks
- [ ] Normal file reads work
- [ ] .env.example readable
- [ ] ripgrep performance unchanged
- [ ] All CLI commands functional
```

### CI Verification

```bash
# Run the new targeted suites
npm test -- tests/unit/path-validator.test.ts --run
npm test -- tests/unit/grep-tool.test.ts --run

# Optional: run full suite (test count may vary)
# npm test
```

---

## SECTION F: Rollback Plan

### Immediate Rollback

```bash
git revert HEAD --no-edit
git push origin main
```

### Selective Rollback

```bash
# Revert specific fix
git revert <commit-sha> --no-edit
```

### Feature Flags

Not recommended for security fixes - they should not be toggleable.

---

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| New tests pass | Targeted test runs exit 0 |
| Symlink protections covered | New symlink tests pass |
| Grep fallback stable | No process leak tests pass |
| Pattern handling robust | `-pattern` tests pass |
| Clear error messages | Both-tools-missing test passes |
| No regressions | Existing tests still pass |

---

## Implementation Order

| Order | ID | Severity | Effort | Dependencies |
|-------|-----|----------|--------|--------------|
| 1 | CODE-003 | MEDIUM | 5 min | None |
| 2 | CODE-001/002 | HIGH | 2-3 hr | None |
| 3 | CODE-004 | MEDIUM | 15 min | CODE-001 |
| 4 | SEC-001 tests | LOW | 1-2 hr | None |
| 5 | Verification | - | 1-2 hr | All above |

---

## Appendix: Files Affected

| File | Changes |
|------|---------|
| `src/tools/grep.ts` | Refactor state management, add `--` separator, improve errors |
| `src/security/path-validator.ts` | Verify env-doc allowlist is read-only (no change if already present) |
| `tests/unit/path-validator.test.ts` | Add symlink security regression tests |
| `tests/unit/grep-tool.test.ts` | Add pattern handling + fallback error tests |

---

**Document End**

*Generated by Opus Subagent Team - Security Auditor, Code Reviewer, Docs Writer*
