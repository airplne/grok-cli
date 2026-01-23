# PRP: Keytar Native Binding Missing When `npm ignore-scripts=true`

**Repo**: `airplne/grok-cli`  
**Area**: Auth / Keychain (`keytar`)  
**Severity**: HIGH (blocks `grok auth login`, disables AI mode)  
**Target Audience**: Claude/Codex Development Team  
**Status**: Ready for Execution  

---

## Problem Statement

Users running `grok auth login` may see:

```
Error: System keychain unavailable
```

The CLI currently suggests rebuilding `keytar`:

```
npm rebuild keytar
```

However, on machines where **npm is configured with `ignore-scripts=true`**, `npm rebuild keytar` will **skip keytar’s install/build scripts** and **will not produce** `node_modules/keytar/build/Release/keytar.node`. Users can follow the remediation exactly and still remain broken.

This is common on hardened dev machines where `ignore-scripts` is enabled globally for supply-chain safety.

---

## Root Cause (Confirmed)

- `keytar@7.9.0` builds its native binding via install script:
  - `prebuild-install || node-gyp rebuild`
- When `npm ignore-scripts=true`, **install scripts do not run**, so the native binding is never built.
- In addition, `prebuild-install` may try to fetch prebuilt artifacts from GitHub; if the machine is offline or GitHub is blocked, that download can fail—but **the build-from-source fallback works** as long as build tooling + `libsecret-1-dev` are installed (Linux).

---

## Goals

1. Detect and surface the **`ignore-scripts=true`** scenario when keytar’s native binding is missing.
2. Provide a **command-scoped fix** that does not require permanently changing npm config:
   - `npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts`
3. Keep the existing security posture:
   - **KEYCHAIN-ONLY** auth remains (no env var/file credential ingestion).
4. Keep output concise, actionable, and platform-aware.

---

## Non-Goals

- Do not run `sudo` automatically or install OS packages.
- Do not automatically change user npm configuration.
- Do not add any alternate credential storage (env vars, `.env`, config files).

---

## Reproduction

### Setup a failing environment

```bash
# Confirm scripts are disabled
npm config get ignore-scripts

# (If needed for repro only)
npm config set ignore-scripts true

cd /path/to/grok-cli
npm ci
node -e "import('keytar').then(()=>console.log('ok')).catch(e=>{console.error(e);process.exit(1)})"
```

Expected failure:
- `Cannot find module '../build/Release/keytar.node'`

### Observe CLI behavior

```bash
grok auth doctor
grok auth login
```

Expected:
- keychain reported unavailable (reason `missing-native-binding`)

---

## Proposed Solution

Enhance keychain remediation to detect **npm scripts disabled** and show the correct rebuild command.

### Implementation Overview

**Primary change**: `src/auth/credential-store.ts`

When `getAvailability()` classifies `reason === 'missing-native-binding'`:
1. Determine whether `npm ignore-scripts` is enabled (best-effort).
2. If enabled, append a clear remediation block explaining why `npm rebuild keytar` did not work and how to override.

Optionally, print the detected value explicitly in `grok auth doctor` output.

---

## Implementation Plan

### Step 1 — Add npm "ignore-scripts" detection helper

Create `src/auth/npm-diagnostics.ts`:

**Function Signature**:
```typescript
export async function getNpmIgnoreScripts(cwd?: string): Promise<boolean | null>
```

**Implementation with Edge Case Handling**:
```typescript
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFilePromise = promisify(execFile);

export async function getNpmIgnoreScripts(cwd?: string): Promise<boolean | null> {
  // Fast path: check env vars (Windows uses both forms)
  const envValue = process.env.npm_config_ignore_scripts ||
                   process.env.NPM_CONFIG_IGNORE_SCRIPTS;

  if (envValue === 'true') return true;
  if (envValue === 'false') return false;

  // Slow path: run npm command with timeout
  try {
    const { stdout } = await execFilePromise('npm', ['config', 'get', 'ignore-scripts'], {
      cwd: cwd || process.cwd(),
      timeout: 2000, // 2 second max (graceful fallback if npm is slow)
      windowsHide: true, // Prevent flash on Windows
    });

    const trimmed = stdout.trim().toLowerCase();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    return null; // Unexpected output (e.g., "undefined", garbage)
  } catch (error) {
    // Edge cases:
    // - npm not in PATH (ENOENT)
    // - npm timeout (ETIMEDOUT)
    // - Permission denied
    // - npm config corruption
    // All handled gracefully: return null (feature disabled, use standard remediation)
    return null;
  }
}
```

**Edge Cases Handled**:
1. **npm not in PATH**: Returns `null`, falls back to standard remediation
2. **npm timeout**: Returns `null` after 2s
3. **Windows env var naming**: Checks both `npm_config_*` and `NPM_CONFIG_*`
4. **Unexpected output**: Returns `null` instead of crashing
5. **Permission errors**: Gracefully returns `null`

Constraints:
- Must be safe: read-only, no prompts, no writes.
- Must be resilient: do not throw; return `null` on failure.

### Step 2 — Update `CredentialStore.getAvailability()` remediation

**File**: `src/auth/credential-store.ts`
**Location**: Line 306 - `if (reason === 'missing-native-binding')`
**Method Signature Change**: `getAvailability()` becomes `async getAvailability()`

**Current Code Structure** (lines 306-346):
```typescript
if (reason === 'missing-native-binding') {
  switch (platform) {
    case 'linux':
      return [
        'Install build tools and libsecret:',
        '  sudo apt update',
        '  sudo apt install -y build-essential libsecret-1-dev',
        '',
        'Then rebuild keytar:',  // ← Line ~325
        '  cd ' + process.cwd(),
        '  npm rebuild keytar',   // ← Line ~327 INJECTION POINT
      ].join('\n');
    // ... macOS, Windows similar structure
  }
}
```

**Modified Implementation**:
```typescript
// Line 291: Make method async
private static async getRemediation(reason: string): Promise<string> {
  const platform = process.platform;

  // ... existing code for other reasons ...

  if (reason === 'missing-native-binding') {
    // NEW: Detect npm ignore-scripts
    const npmIgnoreScripts = await getNpmIgnoreScripts(process.cwd());

    // Build base platform instructions
    const platformSteps: string[] = [];

    switch (platform) {
      case 'linux':
        platformSteps.push(
          'Install build tools and libsecret:',
          '  sudo apt update',
          '  sudo apt install -y build-essential libsecret-1-dev',
          ''
        );
        break;
      // ... macOS, Windows cases
    }

    // Add rebuild instructions with ignore-scripts detection
    platformSteps.push('Then rebuild keytar:');
    platformSteps.push('  cd ' + process.cwd());
    platformSteps.push('');

    if (npmIgnoreScripts === true) {
      platformSteps.push(
        'NOTE: Detected npm ignore-scripts=true (install scripts disabled)',
        'This prevented keytar from building its native binding.',
        '',
        'Fix (command-scoped override - recommended):',
        '  npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts',
        '',
        'Or (permanent config change):',
        '  npm config set ignore-scripts false',
        '  npm rebuild keytar'
      );
    } else {
      platformSteps.push('  npm rebuild keytar');
    }

    return platformSteps.join('\n');
  }

  // ... other cases
}
```

**Callers to Update** (must add `await`):
- `src/auth/credential-store.ts:235` - getAvailability() method itself becomes async
- `src/auth/credential-store.ts:273` - return statement (already in async context)
- `src/commands/handlers/auth.ts` - any call to `CredentialStore.getAvailability()`
- `src/commands/handlers/auth-tui.ts` - any call to `CredentialStore.getAvailability()`

**Find all call sites**:
```bash
rg -n "CredentialStore\.getAvailability\(\)" src/
```

Notes:
- Preserve existing platform-specific build tool instructions (Linux/macOS/Windows) because users may still need them.
- Keep remediation ordering: explain why, then give commands.

### Step 3 — Improve `grok auth doctor` output (optional)

If Step 2 only appends to remediation, doctor output will already include it.

Optional improvement (if the team prefers explicit structured output):
- Add a line in `src/commands/handlers/auth.ts` and `src/commands/handlers/auth-tui.ts`:
  - `npm ignore-scripts: true|false|unknown`

### Step 4 — Tests

**File**: `tests/unit/credential-store.test.ts`

**Challenge**: Testing requires mocking dynamic `import('keytar')` which is complex in Vitest.

**Recommended Approach**: Extract keytar loading to separate testable module.

#### Step 4A: Extract Keytar Loading (Enables Testing)

**Create**: `src/auth/keytar-loader.ts`
```typescript
export async function loadKeytar() {
  const keytar = await import('keytar');
  return keytar;
}
```

**Update**: `src/auth/credential-store.ts`
```typescript
// Replace direct import('keytar') with loadKeytar()
import { loadKeytar } from './keytar-loader.js';

public static async getAvailability(): Promise<KeychainAvailability> {
  try {
    const keytar = await loadKeytar();
    // ... rest of checks
  }
}
```

#### Step 4B: Add Tests with Mocking

**File**: `tests/unit/credential-store.test.ts`

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock both npm-diagnostics and keytar-loader
vi.mock('../../src/auth/npm-diagnostics.js', () => ({
  getNpmIgnoreScripts: vi.fn()
}));

vi.mock('../../src/auth/keytar-loader.js', () => ({
  loadKeytar: vi.fn()
}));

import { getNpmIgnoreScripts } from '../../src/auth/npm-diagnostics.js';
import { loadKeytar } from '../../src/auth/keytar-loader.js';
import { CredentialStore } from '../../src/auth/credential-store.js';

describe('ignore-scripts detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows override command when ignore-scripts=true', async () => {
    // Mock keytar loading failure (native binding missing)
    (loadKeytar as any).mockRejectedValue(
      new Error("Cannot find module '../build/Release/keytar.node'")
    );

    // Mock npm detection: ignore-scripts enabled
    (getNpmIgnoreScripts as any).mockResolvedValue(true);

    const availability = await CredentialStore.getAvailability();

    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('missing-native-binding');
    expect(availability.remediation).toContain('npm_config_ignore_scripts=false');
    expect(availability.remediation).toContain('--foreground-scripts');
  });

  it('shows standard remediation when ignore-scripts=false', async () => {
    (loadKeytar as any).mockRejectedValue(
      new Error("Cannot find module '../build/Release/keytar.node'")
    );

    (getNpmIgnoreScripts as any).mockResolvedValue(false);

    const availability = await CredentialStore.getAvailability();

    expect(availability.remediation).not.toContain('npm_config_ignore_scripts=false');
    expect(availability.remediation).toContain('npm rebuild keytar');
  });

  it('gracefully handles npm detection failure (null)', async () => {
    (loadKeytar as any).mockRejectedValue(
      new Error("Cannot find module '../build/Release/keytar.node'")
    );

    // npm not in PATH, timeout, or other error
    (getNpmIgnoreScripts as any).mockResolvedValue(null);

    const availability = await CredentialStore.getAvailability();

    // Should still show standard remediation (safe fallback)
    expect(availability.available).toBe(false);
    expect(availability.remediation).toContain('npm rebuild keytar');
    expect(availability.remediation).not.toContain('npm_config_ignore_scripts=false');
  });

  it('does not affect successful keytar load', async () => {
    // Mock successful keytar load
    (loadKeytar as any).mockResolvedValue({
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn(),
    });

    const availability = await CredentialStore.getAvailability();

    // npm check should not run when keytar works
    expect(getNpmIgnoreScripts).not.toHaveBeenCalled();
    expect(availability.available).toBe(true);
  });
});
```

Constraints:
- Tests must be deterministic and must not require actual system keychain access.
- All mocks must be cleared between tests (`beforeEach`).

### Step 5 — Documentation

Update `docs/USAGE.md` (or add a short note to `docs/PRP-KEYTAR-KEYCHAIN-AVAILABILITY-FIX.md`) to include:
- A troubleshooting bullet: "If `npm config get ignore-scripts` is `true`, rebuild with `npm_config_ignore_scripts=false`".

---

## Code Anchors & Call Sites

### Signature Change Impact

**GOOD NEWS**: `CredentialStore.getAvailability()` is **already async** (line 239).

**All Call Sites** (already have `await` - no changes needed):
1. `src/auth/auth-service.ts:44` ✅
2. `src/auth/auth-service.ts:142` ✅
3. `src/auth/auth-service.ts:282` ✅
4. `src/index.tsx:176` ✅
5. `src/commands/handlers/auth.ts:74` ✅
6. `src/commands/handlers/auth-tui.ts:86` ✅

**Only Change Needed**: Make `getRemediation()` async (currently private static sync).

**Current** (line ~291):
```typescript
private static getRemediation(reason: string): string {
```

**Updated**:
```typescript
private static async getRemediation(reason: string): Promise<string> {
```

**Caller Update** (line ~275 in getAvailability):
```typescript
// OLD:
remediation: this.getRemediation('missing-native-binding'),

// NEW:
remediation: await this.getRemediation('missing-native-binding'),
```

### Injection Point Details

**File**: `src/auth/credential-store.ts`
**Function**: `getRemediation(reason: string)` (private static)
**Line**: ~306 (current), exact line may shift

**Current Structure**:
```typescript
// Line 306
if (reason === 'missing-native-binding') {
  switch (platform) {
    case 'linux':
      // Lines 320-328
      return [
        'Install build tools and libsecret:',
        '  sudo apt update',
        '  sudo apt install -y build-essential libsecret-1-dev',
        '',
        'Then rebuild keytar:',
        '  cd ' + process.cwd(),
        '  npm rebuild keytar',  // ← REPLACE THIS LINE
      ].join('\n');
  }
}
```

**Modification Strategy**:
1. Change return type: `getRemediation(reason: string): string` → `async getRemediation(reason: string): Promise<string>`
2. Insert `const npmIgnoreScripts = await getNpmIgnoreScripts();` before switch
3. Replace static "npm rebuild keytar" line with conditional block:
   - If `npmIgnoreScripts === true`: insert ignore-scripts override instructions
   - Otherwise: keep standard "npm rebuild keytar"
4. Repeat for all 3 platform cases (darwin, linux, win32)

---

## Acceptance Criteria

1. When `keytar.node` is missing and `npm ignore-scripts=true`:
   - `grok auth doctor` output includes explicit instructions using:
     - `npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts`
2. When `keytar.node` is missing and `npm ignore-scripts=false` (or unknown):
   - Output remains similar to current remediation (no incorrect advice).
3. All tests pass:
   - `npm test`
4. Build passes:
   - `npm run build`

---

## Verification Commands (Manual)

```bash
cd /path/to/grok-cli

# Simulate the failure mode
npm config set ignore-scripts true
npm ci
grok auth doctor

# Fix using the recommended override
npm_config_ignore_scripts=false npm rebuild keytar --foreground-scripts
node -e "import('keytar').then(()=>console.log('keytar ok')).catch(e=>{console.error(e);process.exit(1)})"

grok auth doctor
grok auth login

# Clean up repro setting (optional)
npm config set ignore-scripts false
```

