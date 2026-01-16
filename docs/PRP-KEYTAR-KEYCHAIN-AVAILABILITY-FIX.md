# PRP: Fix Keychain Availability UX (keytar) + Add `grok auth doctor` + Version Output

**Repo**: `airplne/grok-cli`  
**Target**: `main` (post-merge v2.0.0 offline-first)  
**Motivation**: On Pop!_OS/Linux, `grok auth login` fails with “System keychain unavailable (keytar failed to load)”, preventing AI mode enablement even after install. Current output is noisy/duplicated and not always actionable.

---

## Problem Statement

On Linux systems (Pop!_OS), users running:

- `grok auth login`

may see:

- `Warning: System keychain unavailable (keytar failed to load)`
- `Error: System keychain unavailable`

Common underlying error (from node):

- `Cannot find module '../build/Release/keytar.node'`

This typically means `keytar`’s native binding wasn’t built (or required system libs are missing), so the CLI must:

1. Remain usable offline (already true).
2. Provide **clear, single-shot**, platform-specific remediation steps.
3. Provide a deterministic diagnostics path for users (`grok auth doctor`).

---

## Goals

1. **Single, consistent error output** when keytar is unavailable (no duplicate warnings + errors).
2. **Actionable platform steps** for Linux/Pop!_OS (Debian/Ubuntu family), macOS, and Windows.
3. Add `grok auth doctor` and `/auth doctor` for diagnostics.
4. Keep security invariants:
   - No env var auth (`GROK_API_KEY`, `XAI_API_KEY`)
   - No key ingestion via CLI flags, config files, `.env` files, or stdin/pipes
5. Fix `grok --version` to report **actual** package version (currently hardcoded).

---

## Non-Goals

- Do not add any credential fallback path (env vars/files/pipes).
- Do not run `sudo` automatically or install OS packages from the CLI.
- Do not attempt to make keychain auth work without keytar on Linux (offline mode is the designed fallback).

---

## Reproduction & Diagnosis

### Reproduce current failure (Linux)
```bash
grok auth login
```

### Confirm underlying keytar import failure
```bash
node -e "import('keytar').then(()=>console.log('keytar ok')).catch(e=>{console.error(e); process.exit(1)})"
```

Typical failure:
- `Cannot find module '../build/Release/keytar.node'` (native binding missing / not built)

---

## Implementation Plan

### Step 1 — Centralize Keytar Availability (no side-effect logging)

**Problem**: `CredentialStore` prints warnings inside the keytar loader, and callers also print their own messages, producing duplicated/fragmented UX.

**Change**:

1. Update `src/auth/credential-store.ts`:
   - Remove `console.warn()` side effects from keytar loading.
   - Store the load error for later inspection.
   - Add a structured availability helper:

   ```ts
   type KeychainAvailability =
     | { available: true }
     | {
         available: false;
         reason: 'missing-native-binding' | 'missing-system-deps' | 'import-failed';
         errorMessage: string;
         remediation: string;
       };
   ```

   - Add:
     - `CredentialStore.getAvailability(): Promise<KeychainAvailability>`
     - `CredentialStore.formatRemediation(avail): string` (optional helper)

2. Ensure the same remediation messaging is reused by:
   - `src/index.tsx` offline banner (keytar-unavailable case)
   - `src/auth/auth-service.ts` login + status

**Expected outcomes**:
- Keytar failure results in **one** cohesive message block per command.
- No repeated warnings from deep module import code.

---

### Step 2 — Improve Remediation Text (Linux/macOS/Windows)

Update remediation text to be accurate and modern:

**Linux (Debian/Ubuntu/Pop!_OS)**:
- Mention both build toolchain and libsecret dev headers:
  - `sudo apt update`
  - `sudo apt install -y build-essential libsecret-1-dev`
  - `npm rebuild keytar`

Optionally mention `python3` if needed by node-gyp on some machines.

**macOS**:
- `xcode-select --install`
- `npm rebuild keytar`

**Windows**:
- Remove outdated guidance about “windows-build-tools”.
- Recommend installing Visual Studio Build Tools (C++ toolchain) and then `npm rebuild keytar`.

---

### Step 3 — Add Diagnostics Command: `grok auth doctor` + `/auth doctor`

Add:

- CLI: `grok auth doctor`
- TUI: `/auth doctor`

**Behavior**:
- Prints:
  - whether keychain is available
  - detected reason (best-effort classification)
  - remediation commands
  - current Node version (helps explain prebuild mismatch)
- No prompts; never accepts a key; no files written.

**Files**:
- `src/commands/handlers/auth.ts`:
  - add subcommand `doctor`
- `src/commands/handlers/auth-tui.ts`:
  - add `doctor` command handling
- `src/auth/auth-service.ts` or `src/auth/credential-store.ts`:
  - provide formatter used by both CLI/TUI

---

### Step 4 — Remove Duplicate “keytar unavailable” Output

With Step 1 in place, update callers so:

- `src/index.tsx` prints a single offline banner (already prints banner).
- `grok auth status/login` prints a single coherent message and exits non-zero for login failure (status may still be 0/1 depending on existing behavior—keep consistent with current tests).

Ensure:
- `CredentialStore` does not log on import failure.
- only the specific CLI command prints the failure output.

---

### Step 5 — Fix `grok --version` to reflect `package.json`

Currently `src/index.tsx` prints a hardcoded version string.

**Change**:
- In `src/index.tsx`, replace:
  - `console.log('grok-cli version 1.0.0');`
- With a runtime read of the nearest `package.json`:
  - `new URL('../package.json', import.meta.url)` from `dist/index.js` should point to repo root `package.json` once built.
  - Use `fs.readFileSync` and `JSON.parse`.

Add minimal error handling (if read fails, print “unknown”).

---

### Step 6 — Tests

Add/adjust tests to avoid regressions and enforce behavior:

1. Update/add unit tests for keytar availability classification:
   - simulate MODULE_NOT_FOUND error referencing `keytar.node`
   - verify `getAvailability()` returns `available: false` with stable remediation text

2. Add integration test for doctor command:
   - `node dist/index.js auth doctor`
   - should exit 0 and include remediation guidance when keytar isn’t available

3. Add test for `--version`:
   - `node dist/index.js --version` should contain the version from `package.json`

**Constraints**:
- Do not add any tests that require actual system keychain access to pass in CI.
- Keep tests deterministic: mock keytar import behavior.

---

### Step 7 — Documentation Updates

Update docs so users can self-serve on Linux:

- `USAGE.md`:
  - add “Linux keychain setup” section
  - add “Troubleshooting keytar” section
  - include `grok auth doctor`
- `PLATFORM-TESTING.md`:
  - include a Linux checklist for keytar prerequisites
- `MIGRATION.md`:
  - only add a short note pointing users to `grok auth doctor` if they hit keytar issues (avoid reintroducing env var guidance)

---

## Verification Commands (Dev)

Run after implementation:

```bash
npm run build
npm test -- --run

rg -n "process\\.env\\.(GROK_API_KEY|XAI_API_KEY)" src
rg -n "\\.env" src/auth src/index.tsx src/client src/commands
git grep -n "\\.grokrc" src

node dist/index.js --version
node dist/index.js auth doctor
node dist/index.js auth status
```

---

## Acceptance Criteria

1. On a Linux machine where keytar cannot load:
   - `grok auth login` prints **one** clear remediation block and exits non-zero.
   - `grok auth status` prints **one** clear status block.
   - No duplicated “keytar failed to load” warnings from deep module code.

2. `grok auth doctor` exists and prints actionable instructions.

3. `grok --version` prints the actual package version (e.g., `2.0.0`).

4. Security invariants remain true:
   - no env var auth, no key flags, no key via stdin/pipes, no plaintext config file support.

5. Build + tests pass:
   - `npm run build` succeeds
   - `npm test -- --run` passes

