# PRP Readiness Review: Keytar Ignore-Scripts Detection

**Reviewer**: Claude Sonnet 4.5
**PRP**: `docs/PRP-KEYTAR-IGNORE-SCRIPTS-DETECTION.md`
**Verdict**: ✅ **GO with Minor Enhancements**
**Confidence**: 95%

---

## Executive Summary

The PRP is **90% execution-ready** with clear problem definition, well-structured implementation plan, and complete verification protocol. Recommended enhancements before execution: add specific code anchors, clarify test mocking strategy, and document edge cases.

---

## Strengths ✅

### 1. Problem Definition (Excellent)
- Clear symptom: keychain unavailable error
- Root cause identified: npm ignore-scripts prevents build
- User impact: Blocks AI mode entirely
- Environment specificity: Hardened dev machines

### 2. Security Boundaries (Excellent)
- Explicitly preserves keychain-only auth
- No sudo automation
- No config file creation
- Read-only npm detection

### 3. Implementation Plan Structure (Good)
- 5 logical steps
- Clear separation: detection → remediation → tests → docs
- Platform-aware (Linux/macOS/Windows)

### 4. Verification Protocol (Excellent)
- Complete reproduction steps
- Fix verification commands
- Cleanup instructions

---

## Gaps Requiring Enhancement

### Gap #1: Missing Code Anchors (MEDIUM Priority)

**Issue**: Implementation says "update CredentialStore.getAvailability()" but doesn't specify exact injection point.

**Current Code** (`src/auth/credential-store.ts:306-346`):
```typescript
if (reason === 'missing-native-binding') {
  switch (platform) {
    case 'linux':
      return [
        'Install build tools and libsecret:',
        '  sudo apt update',
        '  sudo apt install -y build-essential libsecret-1-dev',
        '',
        'Then rebuild keytar:',
        '  cd ' + process.cwd(),
        '  npm rebuild keytar',  // ← INJECTION POINT
      ].join('\n');
  }
}
```

**Enhancement Needed**:
```markdown
### Step 2 (Enhanced):
Insert ignore-scripts detection AFTER "Then rebuild keytar:" block:

```typescript
const npmIgnoreScripts = await getNpmIgnoreScripts(process.cwd());

const rebuildSteps = npmIgnoreScripts === true
  ? [
      'NOTE: Detected npm ignore-scripts=true',
      '',
      'Fix (command-scoped override):',
      '  npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts',
      '',
      'Or (permanent):',
      '  npm config set ignore-scripts false',
      '  npm rebuild keytar',
    ]
  : [
      'Then rebuild keytar:',
      '  cd ' + process.cwd(),
      '  npm rebuild keytar',
    ];
```

Append rebuildSteps to platform-specific instructions.
```

### Gap #2: Test Mocking Strategy (MEDIUM Priority)

**Issue**: Says "Mock keytar import failure" and "Mock the new npm helper" but doesn't specify the mocking approach.

**Enhancement Needed**:
```markdown
### Step 4 (Enhanced):

**Mocking Approach**:
1. Use `vi.mock()` to mock `src/auth/npm-diagnostics.ts`
2. Test cases:

**Test A**: ignore-scripts=true detected
```typescript
vi.mock('../src/auth/npm-diagnostics.js', () => ({
  getNpmIgnoreScripts: vi.fn().mockResolvedValue(true)
}));

// Then test CredentialStore with simulated keytar failure
const availability = await CredentialStore.getAvailability();
expect(availability.remediation).toContain('npm_config_ignore_scripts=false');
```

**Test B**: ignore-scripts=false (normal)
```typescript
vi.mock('../src/auth/npm-diagnostics.js', () => ({
  getNpmIgnoreScripts: vi.fn().mockResolvedValue(false)
}));

const availability = await CredentialStore.getAvailability();
expect(availability.remediation).not.toContain('npm_config_ignore_scripts');
```

**Test C**: npm detection fails (null)
```typescript
vi.mock('../src/auth/npm-diagnostics.js', () => ({
  getNpmIgnoreScripts: vi.fn().mockResolvedValue(null)
}));

const availability = await CredentialStore.getAvailability();
// Should still show standard remediation (graceful fallback)
```

**Note**: CredentialStore.getAvailability() is currently static/sync. If adding async npm detection, signature becomes `async getAvailability()` and all callers must await.
```

### Gap #3: Edge Cases (LOW Priority)

**Missing Considerations**:
1. What if `npm config get ignore-scripts` times out? (Should return `null` and fallback gracefully)
2. What if npm is not in PATH? (Should catch exec error, return `null`)
3. What if ignore-scripts is per-project vs global? (Command works for both)
4. What if Windows uses different env var name? (Test on Windows)

**Enhancement**:
```markdown
### Step 1 (Add Error Handling):

```typescript
export async function getNpmIgnoreScripts(cwd?: string): Promise<boolean | null> {
  // Fast path: check env vars
  const envValue = process.env.npm_config_ignore_scripts || process.env.NPM_CONFIG_IGNORE_SCRIPTS;
  if (envValue === 'true') return true;
  if (envValue === 'false') return false;

  // Slow path: run npm command with timeout
  try {
    const { stdout } = await execFilePromise('npm', ['config', 'get', 'ignore-scripts'], {
      cwd: cwd || process.cwd(),
      timeout: 2000, // 2 second max
    });

    const trimmed = stdout.trim().toLowerCase();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    return null; // Unexpected output
  } catch (error) {
    // npm not found, timeout, or other error
    return null; // Graceful fallback
  }
}
```
```

### Gap #4: Async Signature Change (MEDIUM Priority)

**Issue**: `CredentialStore.getAvailability()` is currently **synchronous**.

**Current**:
```typescript
// src/auth/credential-store.ts:235
public static getAvailability(): KeychainAvailability {
  try {
    // ... synchronous checks
  }
}
```

**Required Change**:
```typescript
public static async getAvailability(): Promise<KeychainAvailability> {
  try {
    // ... existing checks

    // NEW: Async npm detection
    if (reason === 'missing-native-binding') {
      const npmIgnoreScripts = await getNpmIgnoreScripts();
      // ... build remediation
    }
  }
}
```

**Callers to Update**:
- `src/commands/handlers/auth.ts`
- `src/commands/handlers/auth-tui.ts`
- Anywhere `CredentialStore.getAvailability()` is called

**Enhancement**: PRP should list all call sites and confirm async/await added.

---

## Recommended Additions to PRP

### Section: "Implementation Details"

Add after Step 2:

```markdown
### Code Anchors

**File**: `src/auth/credential-store.ts`

**Location**: Line 306 - `if (reason === 'missing-native-binding')`

**Current Structure**:
```typescript
switch (platform) {
  case 'linux':
    return [
      'Install build tools...',
      '',
      'Then rebuild keytar:',
      '  cd ' + process.cwd(),
      '  npm rebuild keytar',  // ← Line ~327
    ].join('\n');
}
```

**Modification Strategy**:
1. Make getRemediation() async
2. Call await getNpmIgnoreScripts()
3. Conditionally insert ignore-scripts block BEFORE "npm rebuild keytar" line
4. Format:
   ```
   Then rebuild keytar:
     cd /path/to/grok-cli

   [IF ignore-scripts=true, INSERT:]
     NOTE: npm ignore-scripts is enabled (prevents keytar build)

     Fix (temporary override):
       npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts

     Or (permanent):
       npm config set ignore-scripts false
       npm rebuild keytar

   [ELSE:]
     npm rebuild keytar
   ```

**Callers to Update**:
- `src/commands/handlers/auth.ts` → `await CredentialStore.getAvailability()`
- `src/commands/handlers/auth-tui.ts` → `await CredentialStore.getAvailability()`
- `src/index.tsx` (if used at startup)
```

### Section: "Testing Strategy"

Add test implementation details:

```markdown
### Test Mocking Pattern

Use Vitest module mocks:

```typescript
// tests/unit/credential-store.test.ts

import { vi } from 'vitest';

// Mock npm-diagnostics module
vi.mock('../../src/auth/npm-diagnostics.js', () => ({
  getNpmIgnoreScripts: vi.fn()
}));

import { getNpmIgnoreScripts } from '../../src/auth/npm-diagnostics.js';
import { CredentialStore } from '../../src/auth/credential-store.js';

describe('ignore-scripts detection', () => {
  it('shows override when ignore-scripts=true', async () => {
    (getNpmIgnoreScripts as any).mockResolvedValue(true);

    // Simulate keytar missing (harder - may need to mock dynamic import)
    const availability = await CredentialStore.getAvailability();

    expect(availability.remediation).toContain('npm_config_ignore_scripts=false');
  });
});
```

**Challenge**: Testing getAvailability() with mocked keytar import failure requires:
- Mocking dynamic import() calls (complex in Vitest)
- OR: Extract keytar loading to separate testable function

**Recommendation**: Extract keytar loading:
```typescript
// src/auth/keytar-loader.ts
export async function loadKeytar() {
  const keytar = await import('keytar');
  return keytar;
}
```

Then mock loadKeytar() in tests.
```

---

## GO/NO-GO Decision

### ✅ GO - Execute with Enhancements

**Verdict**: PRP is **execution-ready** with minor clarifications.

**Recommended Pre-Execution Steps**:

1. **Add to PRP** (5 minutes):
   - Code anchors (exact line numbers)
   - Async signature change call sites
   - Test mocking pattern

2. **Quick Spike** (15 minutes):
   - Verify `npm config get ignore-scripts` works on Pop!_OS
   - Check if timeout is needed (test on slow machines)

3. **Implementation Order**:
   - Step 1 (npm-diagnostics.ts) → Step 4 (tests) → Step 2 (credential-store) → Step 5 (docs)
   - Test-first ensures mocking works before modifying core code

**Estimated Effort**: 2-3 hours (implementation + tests + verification)

**Risk**: LOW (read-only detection, graceful fallbacks, well-scoped)

---

## Minor Concerns (Non-Blocking)

1. **Async getAvailability()**: Signature change affects multiple call sites (need grep to find all)
2. **Test Complexity**: Mocking dynamic imports is tricky in Vitest (may need refactor)
3. **npm Dependency**: Assumes npm is in PATH (document this assumption)

---

## Final Recommendation

**Status**: ✅ **APPROVED FOR EXECUTION**

**Condition**: Add the 3 enhancements above to PRP before starting implementation.

**Priority**: HIGH (blocks auth on hardened systems)

**Next Step**: Update PRP with code anchors and test mocking details, then execute.
