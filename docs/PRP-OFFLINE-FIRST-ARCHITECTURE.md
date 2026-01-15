# PRP: Offline-First Architecture with Secure Credential Storage

**Status**: Ready for Execution
**Created**: 2026-01-14
**Updated**: 2026-01-14 (Added weekly credential expiration)
**Priority**: HIGH
**Estimated Effort**: 12-16 hours implementation + 4-6 hours testing (includes TTL/expiration)

---

## Executive Summary

Transform grok-cli from "requires export GROK_API_KEY every session" to "offline-first with optional AI via secure credential storage and weekly re-authentication" by:

1. **Storing API keys securely** in system keychain with **7-day TTL** - never in env vars
2. **Enforcing weekly re-login** for security (strict 7-day expiration, no auto-extension)
3. **Running in offline/tool-only mode** when no credential or credential expired
4. **Adding `grok auth login/logout/status` commands** for credential management (CLI and in-TUI)
5. **Making GrokAgent/GrokClient conditional** on credential presence
6. **Extending slash commands** to work in offline mode with clear UX

**Key Benefit**: Users set credentials once via `grok auth login`, re-authenticate weekly for security, never type `export GROK_API_KEY=...` again. Works everywhere, any directory.

---

## A. Current State Analysis (Local Investigation)

### A1. Credential Usage Map

#### src/index.tsx (lines 108-114)
```typescript
// Current: HARD EXIT if no key
if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) {
  console.error('Error: Missing API key.');
  console.error('\nSet GROK_API_KEY or XAI_API_KEY environment variable:');
  console.error('  export GROK_API_KEY="xai-your-key-here"');
  console.error('\nGet your API key from: https://console.x.ai/');
  process.exit(1); // ← BLOCKS OFFLINE MODE
}
```

**Impact**: Cannot run grok-cli without API key
**Required Change**: Make optional, run in offline mode if missing

#### src/client/grok-client.ts (lines 14-22)
```typescript
constructor(config: GrokClientConfig = {}) {
  const apiKey = config.apiKey
    || process.env.GROK_API_KEY
    || process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error( // ← THROWS ERROR
      'Missing API key. Set GROK_API_KEY or XAI_API_KEY environment variable.'
    );
  }

  this.client = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1',
    timeout: config.timeout || 120000,
  });
}
```

**Impact**: Cannot instantiate GrokClient without key
**Required Change**: Make GrokClient instantiation conditional

#### Documentation References

**src/index.tsx (lines 45-46)**: Help text says "GROK_API_KEY (required)"
```typescript
ENVIRONMENT:
  GROK_API_KEY          xAI API key (required)  // ← Remove env var path entirely
  XAI_API_KEY           Alternative API key env var  // ← Remove env var path entirely
```

**Required Change**: Remove environment-variable authentication from help output. Credential management must be via `grok auth login/logout/status` only.

### A2. Network Call Map

**Only Network Source**: OpenAI client (`openai` package v4.58.0)
- Instantiated in src/client/grok-client.ts line 24
- Makes API calls to `https://api.x.ai/v1`
- Used by GrokAgent for AI completions

**Mitigation**: Don't instantiate GrokClient/GrokAgent in offline mode → zero network calls

### A3. Existing Tools (Can Work Offline)

```
src/tools/
├── bash.ts      - Execute shell commands
├── edit.ts      - Edit files (uses path-validator)
├── glob.ts      - File pattern matching
├── grep.ts      - Search files (uses path-validator)
├── read.ts      - Read files (uses path-validator)
├── todo.ts      - Todo management
├── write.ts     - Write files (uses path-validator)
└── base-tool.ts - Tool interface
```

**All tools work without AI** - they just need to be exposed via offline commands.

### A4. Existing Commands (Need Offline Support)

```
src/commands/handlers/
├── help.ts      - Show help (works offline)
├── model.ts     - List/switch models (needs offline handling)
├── clear.ts     - Clear screen (works offline)
├── exit.ts      - Exit CLI (works offline)
└── history.ts   - Show history (needs offline handling)
```

**Missing**: `auth.ts` handler (need to create)

---

## B. Credential Storage Solution

### B1. Recommended Library: keytar

**Why keytar**:
- ✅ Cross-platform (macOS/Windows/Linux)
- ✅ Battle-tested (used by VS Code, Atom, GitHub Desktop)
- ✅ Secure (OS-level encryption)
- ✅ Simple API (async get/set/delete)
- ✅ TypeScript types included
- ⚠️ Native module (requires node-gyp, but prebuilt binaries available)

**Platform Support**:

| Platform | Mechanism | Storage Location |
|----------|-----------|------------------|
| macOS | Keychain Access | `/Library/Keychains/login.keychain` |
| Windows | Credential Manager | Windows Credential Vault |
| Linux | libsecret/Secret Service | gnome-keyring or kwallet |

**Installation**:
```bash
npm install keytar
npm install --save-dev @types/node
```

**API Example**:
```typescript
import keytar from 'keytar';

// Store
await keytar.setPassword('grok-cli', 'api-key', 'xai-abc123');

// Retrieve (returns null if not found)
const key = await keytar.getPassword('grok-cli', 'api-key');

// Delete (returns true if deleted, false if not found)
const deleted = await keytar.deletePassword('grok-cli', 'api-key');
```

**Fallback Strategy**: If keytar fails to build on user's machine:
1. Warn user that secure storage unavailable
2. Fall back to offline mode (tools-only)
3. Provide install instructions for build tools (python, node-gyp)
4. Do **not** accept API keys via environment variables, CLI flags, stdin/pipes, or config files (by design)

---

## C. Proposed Architecture

### C1. Startup Flow

```
┌─────────────────────────────────────────────────────────┐
│ CLI Start (grok or node dist/index.js)                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Check System       │
         │ Keychain for Key   │
         │ (CredentialStore   │
         │  .getKey())        │
         └────────┬───────────┘
                  │
       ┌──────────┼──────────┬───────────────┬──────────────────┐
       │          │          │               │                  │
   KEY FOUND   KEY FOUND    KEY NOT      KEYCHAIN           KEYCHAIN
   (VALID)     (EXPIRED)    FOUND        UNAVAILABLE        ERROR
       │          │          │               │                  │
       ▼          ▼          ▼               ▼                  ▼
 ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐ ┌──────────────┐
 │ AI MODE   │ │ OFFLINE   │ │ OFFLINE   │ │ OFFLINE      │ │ OFFLINE      │
 │ ENABLED   │ │ (EXPIRED) │ │ (NO KEY)  │ │ (NO KEYCHAIN)│ │ (ERROR)      │
 └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────┬───────┘ └──────┬───────┘
       │             │             │               │                  │
       ▼             ▼             ▼               ▼                  ▼
 Init GrokAgent  Skip Agent   Skip Agent     Skip Agent          Skip Agent
 Full TUI        Offline TUI  Offline TUI    Offline TUI         Offline TUI
 All features    Tools only   Tools only     Tools only          Tools only

 Banner:         Banner:      Banner:        Banner:             Banner:
 "AI: Enabled"   "OFFLINE -   "OFFLINE -     "OFFLINE -          "OFFLINE -
 "Expires: X"    Credential   No cred"       Keychain            Error"
                 Expired"                    unavailable"
                 "Re-login"
```

**TTL Check Logic**:
```typescript
const credential = await CredentialStore.getKey();

if (credential && !CredentialStore.isExpired(credential)) {
  // Valid credential → AI mode
} else if (credential exists but expired) {
  // Expired → Offline mode + expiry banner
} else if (no credential) {
  // Missing → Offline mode
} else if (keychain unavailable) {
  // Offline mode + keychain unavailable banner
}
```

### C2. Mode Comparison

| Feature | AI Mode | Offline Mode (No Credential) | Offline Mode (Expired) |
|---------|---------|------------------------------|------------------------|
| TUI | ✅ Full | ✅ Full (banner shows offline) | ✅ Full (banner shows expired) |
| Tools (grep/read/write/etc) | ✅ | ✅ | ✅ |
| AI Chat | ✅ | ❌ "Run 'grok auth login'" | ❌ "Credential expired" |
| /auth status | ✅ Shows expiration date | ℹ️ "No credential configured" | ⚠️ "Credential expired (X days ago)" |
| /model command | ✅ List available models | ℹ️ "AI disabled (no credentials)" | ℹ️ "AI disabled (expired)" |
| /help command | ✅ | ✅ | ✅ |
| /history command | ✅ Show AI conversation | ℹ️ "No AI history (offline mode)" | ℹ️ "No AI history (offline mode)" |
| Tool automation (grok grep ...) | ✅ | ✅ | ✅ |
| Network calls | ✅ To api.x.ai | ❌ None | ❌ None |
| Credential TTL | Expires in 1-7 days | N/A | Requires re-login |

### C3. Credential Management Flow

#### Login (Interactive)
```bash
$ grok auth login
? Enter your xAI API key: [hidden input]
✓ Credential stored securely in system keychain
✓ AI mode will be enabled next time you run grok
```

#### Login (Non-Interactive)
Not supported (by design). `grok auth login` requires hidden interactive input to avoid leaking
credentials via shell history or pipes.

#### Status
```bash
$ grok auth status

# If valid credential:
✓ Credential configured (AI mode enabled)
  Provider: xAI Grok
  Stored: 2026-01-07
  Expires: 2026-01-14 (in 3 days)
  Storage: System keychain (encrypted)

# If expired credential:
✗ Credential expired (offline mode)
  Last login: 2026-01-07
  Expired: 2026-01-14 (3 days ago)

  Run 'grok auth login' to re-enable AI

# If no credential:
✗ No credential configured (offline mode)
ℹ️  Run 'grok auth login' to enable AI features
ℹ️  Credentials expire after 7 days for security
```

#### Logout
```bash
$ grok auth logout
? Remove stored credential? (y/N) y
✓ Credential removed from system keychain
ℹ️ Offline mode will be used next time you run grok
```

### C4. In-TUI Auth Commands

```
TUI> /auth login
[Opens readline prompt within TUI]
? Enter your xAI API key: [hidden]
✓ Stored. Restart grok to enable AI.

TUI> /auth status
✓ Credential configured

TUI> /auth logout
? Remove stored credential? (y/N) y
✓ Removed. Restart grok to disable AI.
```

### C3.5: Credential Expiration Flow

#### Expiration Policy: Strict Weekly (Option A)

**TTL**: 7 days (604,800,000 milliseconds)
**Policy**: Fixed expiration at login time, no auto-extension
**Rationale**:
- Forces regular re-authentication for security
- Simple, predictable behavior
- Users know exactly when re-login needed

#### Metadata Storage

When storing a credential, save JSON metadata alongside the key:

```json
{
  "apiKey": "xai-abc123...",
  "storedAt": 1705276800000,
  "expiresAt": 1705881600000
}
```

**Fields**:
- `apiKey`: The actual API key
- `storedAt`: UTC timestamp (ms) when credential was stored
- `expiresAt`: UTC timestamp (ms) when credential expires (storedAt + 7 days)

**Storage**: Store metadata as JSON string in keychain under account name `api-key-metadata`

#### Expiration Checking

**On CLI startup** (`src/index.tsx`):
```typescript
const credential = await CredentialStore.getKey();

if (!credential) {
  // No credential => offline mode
  offlineMode = true;
} else if (credential.expiresAt < Date.now()) {
  // Expired => offline mode + expiry message
  offlineMode = true;
  console.log('⚠️  Credential expired (login required)');
  console.log('   Run \'grok auth login\' to re-enable AI');
} else {
  // Valid => AI mode
  offlineMode = false;
  apiKey = credential.apiKey;
}
```

#### Status Display

**`grok auth status` output** (when configured):
```
✓ Credential configured (AI mode enabled)
  Provider: xAI Grok
  Stored: 2026-01-07
  Expires: 2026-01-14 (in 3 days)
  Storage: System keychain (encrypted)
```

**`grok auth status` output** (when expired):
```
✗ Credential expired (offline mode)
  Last login: 2026-01-07
  Expired: 2026-01-14 (3 days ago)

  Run 'grok auth login' to re-enable AI
```

#### Expiration Timeline

```
Day 0: grok auth login
       └─> Credential stored, expiresAt = Day 7

Day 1-6: grok works in AI mode
         └─> No warnings, full functionality

Day 7: grok starts in OFFLINE mode
       └─> Banner: "Credential expired (login required)"
       └─> User must run: grok auth login

Day 8+: Still offline until re-login
```

### C5. Automation Mode (Tool Execution)

```bash
# Works in both AI and offline mode
grok grep "pattern" ./src
grok read ./path/to/file.txt
grok --exec grep "TODO" ./

# Offline mode output:
ℹ️ Running in offline mode (tools only)
[grep output]
```

---

## D. Implementation Plan (Step-by-Step)

### Phase 1: Credential Storage Infrastructure (3-4 hours)

#### Step 1.1: Install keytar

```bash
cd /home/aip0rt/Desktop/grok-cli

# Install keytar
npm install keytar

# Verify installation
npm list keytar
```

**Acceptance**:
- keytar listed in package.json dependencies
- Build succeeds: `npm run build`

**Rollback**: If build fails, document error and proceed with offline/tool-only mode until keytar builds successfully

---

#### Step 1.2: Create Credential Store Wrapper (with TTL)

**File**: `src/auth/credential-store.ts` (NEW)

```typescript
/**
 * Credential Store with TTL
 *
 * Securely stores API keys with expiration metadata in system keychain.
 * Credentials expire after 7 days and require re-login.
 */

import type keytar from 'keytar';

const SERVICE_NAME = 'grok-cli';
const ACCOUNT_KEY = 'api-key';
const ACCOUNT_METADATA = 'api-key-metadata';

// TTL: 7 days in milliseconds
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000 ms

export interface CredentialMetadata {
  apiKey: string;
  storedAt: number;    // UTC timestamp (ms)
  expiresAt: number;   // UTC timestamp (ms)
}

let keytarModule: typeof keytar | null = null;
let keytarError: Error | null = null;

/**
 * Lazy-load keytar to handle build failures gracefully
 */
async function getKeytar(): Promise<typeof keytar | null> {
  if (keytarModule) return keytarModule;
  if (keytarError) return null;

  try {
    keytarModule = await import('keytar');
    return keytarModule;
  } catch (err) {
    keytarError = err as Error;
    console.warn('⚠️  System keychain unavailable (keytar failed to load)');
    console.warn('   Credential storage disabled. AI mode unavailable until keytar is installed and loads successfully.');
    return null;
  }
}

export class CredentialStore {
  /**
   * Store API key with expiration metadata in system keychain
   * TTL: 7 days from storage time
   */
  static async setKey(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key cannot be empty');
    }

    const kt = await getKeytar();
    if (!kt) {
      throw new Error('System keychain unavailable. Cannot store credential securely.');
    }

    const now = Date.now();
    const metadata: CredentialMetadata = {
      apiKey,
      storedAt: now,
      expiresAt: now + TTL_MS
    };

    // Store metadata as JSON
    const metadataJson = JSON.stringify(metadata);
    await kt.setPassword(SERVICE_NAME, ACCOUNT_METADATA, metadataJson);

    // Also store raw key for backwards compatibility (optional - can remove)
    await kt.setPassword(SERVICE_NAME, ACCOUNT_KEY, apiKey);
  }

  /**
   * Retrieve API key with expiration checking
   * Returns null if:
   * - Not found
   * - Expired
   * - Invalid metadata
   */
  static async getKey(): Promise<CredentialMetadata | null> {
    const kt = await getKeytar();
    if (!kt) return null;

    try {
      const metadataJson = await kt.getPassword(SERVICE_NAME, ACCOUNT_METADATA);

      if (!metadataJson) {
        // Try legacy key storage (for migration)
        const legacyKey = await kt.getPassword(SERVICE_NAME, ACCOUNT_KEY);
        if (legacyKey) {
          // Migrate to metadata format
          console.log('ℹ️  Migrating credential to new format with expiration...');
          await this.setKey(legacyKey);
          return await this.getKey(); // Re-read with metadata
        }
        return null;
      }

      const metadata: CredentialMetadata = JSON.parse(metadataJson);

      // Validate metadata structure
      if (!metadata.apiKey || !metadata.storedAt || !metadata.expiresAt) {
        console.warn('⚠️  Invalid credential metadata, removing...');
        await this.deleteKey();
        return null;
      }

      // Check expiration
      if (this.isExpired(metadata)) {
        return null; // Expired - return null (caller handles offline mode)
      }

      return metadata;
    } catch (err) {
      console.warn('⚠️  Failed to read from keychain:', err);
      return null;
    }
  }

  /**
   * Remove API key and metadata from system keychain
   */
  static async deleteKey(): Promise<boolean> {
    const kt = await getKeytar();
    if (!kt) return false;

    try {
      // Delete both metadata and legacy key
      const deletedMetadata = await kt.deletePassword(SERVICE_NAME, ACCOUNT_METADATA);
      const deletedKey = await kt.deletePassword(SERVICE_NAME, ACCOUNT_KEY);

      return deletedMetadata || deletedKey;
    } catch (err) {
      console.warn('⚠️  Failed to delete from keychain:', err);
      return false;
    }
  }

  /**
   * Check if credential exists (even if expired)
   */
  static async hasKey(): Promise<boolean> {
    const kt = await getKeytar();
    if (!kt) return false;

    try {
      const metadataJson = await kt.getPassword(SERVICE_NAME, ACCOUNT_METADATA);
      return metadataJson !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get credential status including expiration info
   */
  static async getStatus(): Promise<{
    exists: boolean;
    expired: boolean;
    metadata: CredentialMetadata | null;
    daysRemaining?: number;
  }> {
    const metadata = await this.getKey();

    if (!metadata) {
      // Check if expired credential exists
      const kt = await getKeytar();
      if (kt) {
        const metadataJson = await kt.getPassword(SERVICE_NAME, ACCOUNT_METADATA);
        if (metadataJson) {
          try {
            const expiredMeta: CredentialMetadata = JSON.parse(metadataJson);
            return {
              exists: true,
              expired: true,
              metadata: expiredMeta,
              daysRemaining: 0
            };
          } catch {
            return { exists: false, expired: false, metadata: null };
          }
        }
      }
      return { exists: false, expired: false, metadata: null };
    }

    // Valid credential
    const daysRemaining = Math.ceil((metadata.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));

    return {
      exists: true,
      expired: false,
      metadata,
      daysRemaining
    };
  }

  /**
   * Check if credential is expired
   */
  static isExpired(metadata: CredentialMetadata): boolean {
    return Date.now() >= metadata.expiresAt;
  }

  /**
   * Check if keytar is available
   */
  static async isAvailable(): Promise<boolean> {
    return (await getKeytar()) !== null;
  }

  /**
   * Get TTL in days
   */
  static getTTLDays(): number {
    return 7;
  }
}
```

**Verification**:
```bash
npm run build
# Should compile without errors

# Test (if keytar built successfully):
node -e "import('./dist/auth/credential-store.js').then(m => m.CredentialStore.isAvailable().then(console.log))"
# Expected: true (if keytar works) or false (if not)
```

---

#### Step 1.3: Create Auth Service (with TTL Support)

**File**: `src/auth/auth-service.ts` (NEW)

```typescript
/**
 * Auth Service
 *
 * Handles login, logout, and status operations for credential management.
 */

import { CredentialStore } from './credential-store.js';
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';

export interface AuthResult {
  success: boolean;
  message: string;
}

export interface StatusResult {
  configured: boolean;
  message: string;
  details?: {
    provider: string;
    keychainAvailable: boolean;
  };
}

export class AuthService {
  /**
   * Interactive login - prompts for API key and stores it
   */
  static async login(): Promise<AuthResult> {
    try {
      // Check if keytar is available
      const keychainAvailable = await CredentialStore.isAvailable();
	      if (!keychainAvailable) {
	        return {
	          success: false,
	          message: '✗ System keychain unavailable\n' +
	                   'Credential storage requires keytar (native module).\n' +
	                   'Install build tools and retry, or continue in offline mode.\n'
	        };
	      }

      // Get API key (hidden interactive prompt)
      const apiKey = await this.promptForKey();

      if (!apiKey || apiKey.trim() === '') {
        return { success: false, message: '✗ API key cannot be empty' };
      }

      // Basic validation (xAI keys typically start with 'xai-')
      if (!apiKey.startsWith('xai-')) {
        console.warn('⚠️  Warning: API key does not start with "xai-"');
        console.warn('   xAI API keys usually have format: xai-...');
        console.warn('   Continuing anyway...\n');
      }

      // Store in keychain
      await CredentialStore.setKey(apiKey);

      return {
        success: true,
        message: '✓ Credential stored securely in system keychain\n' +
                 '✓ AI mode will be enabled next time you run grok\n' +
                 'ℹ️  Credential persists across terminal sessions and directories'
      };
    } catch (err) {
      return {
        success: false,
        message: `✗ Failed to store credential: ${(err as Error).message}`
      };
    }
  }

  /**
   * Logout - removes stored credential
   */
  static async logout(options: { force?: boolean } = {}): Promise<AuthResult> {
    try {
      const hasKey = await CredentialStore.hasKey();

      if (!hasKey) {
        return {
          success: false,
          message: 'ℹ️  No credential configured (already in offline mode)'
        };
      }

      // Confirm unless --force
      if (!options.force) {
        const confirmed = await this.confirmLogout();
        if (!confirmed) {
          return { success: false, message: 'Logout cancelled' };
        }
      }

      const deleted = await CredentialStore.deleteKey();

      if (!deleted) {
        return {
          success: false,
          message: '✗ Failed to remove credential from keychain'
        };
      }

      return {
        success: true,
        message: '✓ Credential removed from system keychain\n' +
                 'ℹ️  Offline mode will be used next time you run grok'
      };
    } catch (err) {
      return {
        success: false,
        message: `✗ Failed to remove credential: ${(err as Error).message}`
      };
    }
  }

  /**
   * Check credential status with expiration info
   */
  static async status(): Promise<StatusResult> {
    try {
      const keychainAvailable = await CredentialStore.isAvailable();
      const status = await CredentialStore.getStatus();

	      if (!keychainAvailable) {
	        return {
	          configured: false,
	          message: '✗ System keychain unavailable\n' +
	                   'ℹ️  Offline mode active\n' +
	                   'ℹ️  Install keytar build dependencies to enable secure credential storage.',
	          details: {
	            provider: 'None',
	            keychainAvailable: false
	          }
	        };
	      }

      if (status.exists && status.expired) {
        // Credential exists but expired
        const storedDate = new Date(status.metadata!.storedAt).toLocaleDateString();
        const expiredDate = new Date(status.metadata!.expiresAt).toLocaleDateString();
        const daysAgo = Math.floor((Date.now() - status.metadata!.expiresAt) / (24 * 60 * 60 * 1000));

        return {
          configured: false,
          message: `✗ Credential expired (offline mode)\n` +
                   `  Last login: ${storedDate}\n` +
                   `  Expired: ${expiredDate} (${daysAgo} days ago)\n\n` +
                   `  Run 'grok auth login' to re-enable AI`,
          details: {
            provider: 'xAI Grok (expired)',
            keychainAvailable: true
          }
        };
      }

      if (status.exists && !status.expired) {
        // Valid credential
        const storedDate = new Date(status.metadata!.storedAt).toLocaleDateString();
        const expiresDate = new Date(status.metadata!.expiresAt).toLocaleDateString();
        const daysRemaining = status.daysRemaining!;

        return {
          configured: true,
          message: `✓ Credential configured (AI mode enabled)\n` +
                   `  Provider: xAI Grok\n` +
                   `  Stored: ${storedDate}\n` +
                   `  Expires: ${expiresDate} (in ${daysRemaining} days)\n` +
                   `  Storage: System keychain (encrypted)`,
          details: {
            provider: 'xAI Grok',
            keychainAvailable: true
          }
        };
      }

      // No credential
      return {
        configured: false,
        message: '✗ No credential configured (offline mode)\n' +
                 'ℹ️  Run \'grok auth login\' to enable AI features\n' +
                 'ℹ️  Credentials expire after 7 days for security',
        details: {
          provider: 'None',
          keychainAvailable: true
        }
      };
    } catch (err) {
      return {
        configured: false,
        message: `✗ Error checking credential: ${(err as Error).message}`
      };
    }
  }

  /**
   * Prompt user for API key (hidden input)
   */
  private static async promptForKey(): Promise<string> {
    const rl = readline.createInterface({ input, output });

    return new Promise((resolve) => {
      let hidden = false;

      rl.question('? Enter your xAI API key: ', (answer) => {
        rl.close();
        console.log(); // New line after hidden input
        resolve(answer.trim());
      });

      // Hide input for security
      rl.on('line', () => {
        hidden = true;
      });

      // Override _writeToOutput to hide characters
      const originalWrite = (rl as any)._writeToOutput;
      (rl as any)._writeToOutput = function (char: string) {
        if (!hidden && char !== '\r' && char !== '\n') {
          // Don't echo characters (hidden input)
          return;
        }
        originalWrite.call(this, char);
      };
    });
  }

  /**
   * Confirm logout action
   */
  private static async confirmLogout(): Promise<boolean> {
    const rl = readline.createInterface({ input, output });

    return new Promise((resolve) => {
      rl.question('? Remove stored credential? (y/N) ', (answer) => {
        rl.close();
        const normalized = answer.toLowerCase().trim();
        resolve(normalized === 'y' || normalized === 'yes');
      });
    });
  }
}
```

**Verification**:
```bash
npm run build
# Should compile without errors
```

---

### Phase 2: Command Integration (2-3 hours)

#### Step 2.1: Add Auth Command Handler

**File**: `src/commands/handlers/auth.ts` (NEW)

```typescript
/**
 * Auth Command Handler
 *
 * Handles /auth login, /auth logout, /auth status commands
 */

import { AuthService } from '../../auth/auth-service.js';

export async function handleAuthCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'login':
      await handleLogin();
      break;

    case 'logout':
      await handleLogout(flags);
      break;

    case 'status':
      await handleStatus();
      break;

    default:
      console.error(`✗ Unknown auth subcommand: ${subcommand}`);
      console.log('\nUsage:');
      console.log('  grok auth login            Store API key securely');
      console.log('  grok auth logout [--force]  Remove stored API key');
      console.log('  grok auth status            Check credential status');
      process.exit(1);
  }
}

async function handleLogin(): Promise<void> {
  const result = await AuthService.login();

  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

async function handleLogout(flags: Record<string, string | boolean>): Promise<void> {
  const force = flags.force === true || flags.f === true;
  const result = await AuthService.logout({ force });

  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

async function handleStatus(): Promise<void> {
  const result = await AuthService.status();
  console.log(result.message);
  process.exit(0);
}
```

**Verification**:
```bash
npm run build
# Should compile without errors
```

---

#### Step 2.2: Register Auth Command in CLI

**File**: `src/index.tsx`

**Change 1**: Add auth command routing (before starting TUI)

**Location**: After argument parsing, before API key check (around line 100)

**Add**:
```typescript
// Handle auth commands (before TUI)
if (args[0] === 'auth') {
  const { handleAuthCommand } = await import('./commands/handlers/auth.js');
  await handleAuthCommand(args.slice(1), {});
  process.exit(0); // Auth commands exit after execution
}
```

**Complete modified section** (lines 100-118):
```typescript
// Extract prompt (remaining non-flag arguments)
const prompt = args
  .filter(a => !a.startsWith('-'))
  .join(' ')
  .trim() || undefined;

// NEW: Handle auth commands (before TUI, before key check)
if (args[0] === 'auth') {
  const { handleAuthCommand } = await import('./commands/handlers/auth.js');
  await handleAuthCommand(args.slice(1), {});
  process.exit(0);
}

// MODIFIED: Check for API key (keychain only, with TTL check)
import { CredentialStore } from './auth/credential-store.js';

let apiKey: string | null = null;
let offlineMode = false;
let expiryReason: string | null = null;

const keychainAvailable = await CredentialStore.isAvailable();

if (!keychainAvailable) {
  offlineMode = true;
  expiryReason = 'keychain-unavailable';
} else {
  // Try keychain (returns null if missing or expired)
  const credential = await CredentialStore.getKey();

  if (credential) {
    apiKey = credential.apiKey;
    offlineMode = false;
  } else {
    // Distinguish expired vs missing for UX
    const status = await CredentialStore.getStatus();
    offlineMode = true;
    expiryReason = status.exists && status.expired ? 'expired' : 'missing';
  }
}

if (offlineMode) {
  console.log('');
  if (expiryReason === 'expired') {
    console.log('⚠️  OFFLINE MODE - Credential Expired');
    console.log('   Your credential expired. Run \'grok auth login\' to re-authenticate.');
    console.log('   Credentials expire every 7 days for security.');
  } else if (expiryReason === 'keychain-unavailable') {
    console.log('⚠️  OFFLINE MODE - System Keychain Unavailable');
    console.log('   Credential storage requires keytar (native module).');
    console.log('   Install keytar build dependencies, then run \'grok auth login\'.');
  } else {
    console.log('ℹ️  OFFLINE MODE (No AI)');
    console.log('   Run \'grok auth login\' to enable AI features.');
  }
  console.log('   Tools available: grep, read, write, edit, glob, bash, todo');
  console.log('');
}

// Render the app (AI mode if key present, offline mode if not)
render(<App initialPrompt={prompt} model={model} apiKey={apiKey} offlineMode={offlineMode} />);
```

**Change 2**: Update help text (lines 44-47)

**OLD**:
```typescript
ENVIRONMENT:
  GROK_API_KEY          xAI API key (required)
  XAI_API_KEY           Alternative API key env var
```

**NEW**:
```typescript
AUTHENTICATION:
  grok auth login       Store API key securely (recommended)
  grok auth logout      Remove stored API key
  grok auth status      Check credential status
```

**Verification**:
```bash
npm run build

# Test auth command routing
node dist/index.js auth --help
# Should show usage, not start TUI
```

---

#### Step 2.3: Add In-TUI Auth Commands

**File**: `src/commands/index.ts`

**Add** auth command to command registry:

```typescript
// Existing imports
import { handleHelpCommand } from './handlers/help.js';
import { handleModelCommand } from './handlers/model.js';
import { handleClearCommand } from './handlers/clear.js';
import { handleExitCommand } from './handlers/exit.js';
import { handleHistoryCommand } from './handlers/history.js';

// NEW: Import auth handler
import { handleAuthCommand } from './handlers/auth.js';

// Existing command map
export const COMMANDS = {
  help: handleHelpCommand,
  model: handleModelCommand,
  clear: handleClearCommand,
  exit: handleExitCommand,
  history: handleHistoryCommand,

  // NEW: Add auth command
  auth: handleAuthCommand,
} as const;
```

**Note**: The handleAuthCommand needs a TUI-compatible version. Create a wrapper:

**File**: `src/commands/handlers/auth.ts`

**Add** TUI-compatible wrapper at the end:

```typescript
/**
 * TUI version of auth handler (doesn't call process.exit)
 */
export async function handleAuthCommandTUI(
  args: string[],
  flags: Record<string, string | boolean>,
  onMessage: (msg: string) => void
): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'login':
      const loginResult = await AuthService.login();
      onMessage(loginResult.message);
      if (loginResult.success) {
        onMessage('\nℹ️  Restart grok to enable AI mode');
      }
      break;

    case 'logout':
      const logoutResult = await AuthService.logout({ force: false });
      onMessage(logoutResult.message);
      if (logoutResult.success) {
        onMessage('\nℹ️  Restart grok to enter offline mode');
      }
      break;

    case 'status':
      const statusResult = await AuthService.status();
      onMessage(statusResult.message);
      break;

    default:
      onMessage(`✗ Unknown auth subcommand: ${subcommand}`);
      onMessage('\nUsage:');
      onMessage('  /auth login   - Store API key securely');
      onMessage('  /auth logout  - Remove stored API key');
      onMessage('  /auth status  - Check credential status');
  }
}
```

**Update command map** to use TUI version:

```typescript
export const COMMANDS = {
  // ... other commands

  auth: async (args: string[], flags: Record<string, string | boolean>, context: any) => {
    await handleAuthCommandTUI(args, flags, (msg) => {
      context.addMessage({ role: 'system', content: msg });
    });
  },
} as const;
```

---

### Phase 3: Conditional AI Initialization (2-3 hours)

#### Step 3.1: Modify App Component for Offline Mode

**File**: `src/ui/app.tsx`

**Change**: Add props for offline mode

**OLD** (around line 10):
```typescript
interface AppProps {
  initialPrompt?: string;
  model?: string;
}

export function App({ initialPrompt, model }: AppProps) {
```

**NEW**:
```typescript
interface AppProps {
  initialPrompt?: string;
  model?: string;
  apiKey?: string | null;  // NEW: API key from keychain/env
  offlineMode?: boolean;     // NEW: Whether running in offline mode
}

export function App({ initialPrompt, model, apiKey, offlineMode = false }: AppProps) {
```

**Add offline banner** (after imports, before main return):

```typescript
export function App({ initialPrompt, model, apiKey, offlineMode = false }: AppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);

  // NEW: Initialize GrokAgent only if we have API key
  const [agent] = useState(() => {
    if (apiKey && !offlineMode) {
      return new GrokAgent({ apiKey, model });
    }
    return null; // Offline mode - no agent
  });

  // NEW: Render offline banner if in offline mode
  const renderBanner = () => {
    if (!offlineMode) return null;

    return (
      <Box
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
        marginBottom={1}
      >
        <Text bold color="yellow">
          ⚠️  OFFLINE MODE (No AI)
        </Text>
        <Text dimColor> - Tools available: grep, read, write, edit, glob, bash, todo</Text>
        <Text dimColor> - Run 'grok auth login' to enable AI features</Text>
      </Box>
    );
  };

  // Modify input handling for offline mode
  const handleSubmit = async (userInput: string) => {
    if (offlineMode && !isCommand(userInput)) {
      // In offline mode, non-command input shows helper message
      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: userInput
        },
        {
          role: 'system',
          content: 'AI chat disabled (offline mode)\n\n' +
                   'Available commands:\n' +
                   '  /help     - Show all commands\n' +
                   '  /auth login - Enable AI mode\n\n' +
                   'Available tools (use /help for details):\n' +
                   '  grep, read, write, edit, glob, bash, todo'
        }
      ]);
      setInput('');
      return;
    }

    // Existing submit logic for commands and AI (when not offline)
    // ...
  };

  return (
    <Box flexDirection="column">
      {renderBanner()}
      {/* Rest of existing UI */}
    </Box>
  );
}
```

---

#### Step 3.2: Update GrokClient to Accept Key

**File**: `src/client/grok-client.ts`

**Change**: Make constructor accept key, don't throw if missing (caller's responsibility)

**OLD** (lines 13-22):
```typescript
constructor(config: GrokClientConfig = {}) {
  const apiKey = config.apiKey
    || process.env.GROK_API_KEY
    || process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing API key. Set GROK_API_KEY or XAI_API_KEY environment variable.'
    );
  }
```

**NEW**:
```typescript
constructor(config: GrokClientConfig = {}) {
  // apiKey must be provided by the caller (CredentialStore via `grok auth login`)
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error(
      'GrokClient requires apiKey. Run `grok auth login` to configure credentials.'
    );
  }

  // Note: Caller should check for key before instantiating GrokClient
  // In offline mode, GrokClient should never be instantiated
```

**No functional change**, just clarify responsibility in comment.

---

#### Step 3.3: Update Model Command for Offline Mode

**File**: `src/commands/handlers/model.ts`

**Add** offline mode handling at the beginning:

```typescript
export async function handleModelCommand(
  args: string[],
  flags: Record<string, string | boolean>,
  context: CommandContext
) {
  // NEW: Check if in offline mode
	  if (context.offlineMode) {
	    context.addMessage({
	      role: 'system',
	      content: '✗ AI disabled (no credentials configured)\n\n' +
	               'Run \'grok auth login\' to enable AI and list models\n\n' +
	               'Credentials are stored in the system keychain (no env vars, no config files).'
	    });
	    return;
	  }

  // Existing model listing logic
  // ...
}
```

**Update CommandContext type** to include offlineMode:

**File**: `src/commands/types.ts`

**Add**:
```typescript
export interface CommandContext {
  agent: GrokAgent | null;  // null in offline mode
  offlineMode: boolean;      // NEW: whether in offline mode
  addMessage: (msg: Message) => void;
  // ... other context properties
}
```

---

### Phase 4: Testing (3-4 hours)

#### Step 4.1: Unit Tests for Credential Store

**File**: `tests/unit/credential-store.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialStore } from '../../src/auth/credential-store';

// Mock keytar
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn()
  }
}));

describe('CredentialStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store API key via keytar', async () => {
    const keytar = await import('keytar');

    await CredentialStore.setKey('xai-test-key');

    expect(keytar.default.setPassword).toHaveBeenCalledWith(
      'grok-cli',
      'api-key',
      'xai-test-key'
    );
  });

  it('should retrieve API key via keytar', async () => {
    const keytar = await import('keytar');
    vi.mocked(keytar.default.getPassword).mockResolvedValue('xai-stored-key');

    const key = await CredentialStore.getKey();

    expect(key).toBe('xai-stored-key');
    expect(keytar.default.getPassword).toHaveBeenCalledWith(
      'grok-cli',
      'api-key'
    );
  });

  it('should return null if key not found', async () => {
    const keytar = await import('keytar');
    vi.mocked(keytar.default.getPassword).mockResolvedValue(null);

    const key = await CredentialStore.getKey();

    expect(key).toBeNull();
  });

  it('should delete API key via keytar', async () => {
    const keytar = await import('keytar');
    vi.mocked(keytar.default.deletePassword).mockResolvedValue(true);

    const deleted = await CredentialStore.deleteKey();

    expect(deleted).toBe(true);
    expect(keytar.default.deletePassword).toHaveBeenCalledWith(
      'grok-cli',
      'api-key'
    );
  });

  it('should reject empty API key', async () => {
    await expect(CredentialStore.setKey('')).rejects.toThrow('cannot be empty');
    await expect(CredentialStore.setKey('  ')).rejects.toThrow('cannot be empty');
  });

  it('should check if key exists', async () => {
    const keytar = await import('keytar');

    // Key exists
    vi.mocked(keytar.default.getPassword).mockResolvedValue('xai-key');
    expect(await CredentialStore.hasKey()).toBe(true);

    // Key does not exist
    vi.mocked(keytar.default.getPassword).mockResolvedValue(null);
    expect(await CredentialStore.hasKey()).toBe(false);
  });
});
```

---

#### Step 4.2: Unit Tests for Auth Service

**File**: `tests/unit/auth-service.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/auth/auth-service';
import { CredentialStore } from '../../src/auth/credential-store';

vi.mock('../../src/auth/credential-store');

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should reject login if keychain unavailable', async () => {
      vi.mocked(CredentialStore.isAvailable).mockResolvedValue(false);

      const result = await AuthService.login();

      expect(result.success).toBe(false);
      expect(result.message).toContain('keychain unavailable');
    });
  });

  describe('logout', () => {
    it('should return early if no key configured', async () => {
      vi.mocked(CredentialStore.hasKey).mockResolvedValue(false);

      const result = await AuthService.logout({ force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No credential');
    });

    it('should delete key with force flag', async () => {
      vi.mocked(CredentialStore.hasKey).mockResolvedValue(true);
      vi.mocked(CredentialStore.deleteKey).mockResolvedValue(true);

      const result = await AuthService.logout({ force: true });

      expect(result.success).toBe(true);
      expect(CredentialStore.deleteKey).toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('should report configured when key exists', async () => {
      vi.mocked(CredentialStore.isAvailable).mockResolvedValue(true);
      vi.mocked(CredentialStore.hasKey).mockResolvedValue(true);

      const result = await AuthService.status();

      expect(result.configured).toBe(true);
      expect(result.message).toContain('AI mode enabled');
    });

    it('should report not configured when no key', async () => {
      vi.mocked(CredentialStore.isAvailable).mockResolvedValue(true);
      vi.mocked(CredentialStore.hasKey).mockResolvedValue(false);

      const result = await AuthService.status();

      expect(result.configured).toBe(false);
      expect(result.message).toContain('offline mode');
    });
  });
});
```

---

#### Step 4.3: TTL Logic Tests

**File**: `tests/unit/credential-ttl.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CredentialStore, type CredentialMetadata } from '../../src/auth/credential-store';

vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn()
  }
}));

describe('CredentialStore TTL Logic', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store credential with 7-day TTL', async () => {
    const keytar = await import('keytar');
    const now = Date.now();

    // Mock Date.now for predictable timestamps
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await CredentialStore.setKey('xai-test-key');

    const setCall = vi.mocked(keytar.default.setPassword).mock.calls[0];
    expect(setCall[0]).toBe('grok-cli');
    expect(setCall[1]).toBe('api-key-metadata');

    const metadata: CredentialMetadata = JSON.parse(setCall[2]);
    expect(metadata.apiKey).toBe('xai-test-key');
    expect(metadata.storedAt).toBe(now);
    expect(metadata.expiresAt).toBe(now + 7 * DAY_MS);
  });

  it('should return null for expired credential', async () => {
    const keytar = await import('keytar');
    const now = Date.now();

    // Credential stored 10 days ago (expired 3 days ago)
    const expiredMetadata: CredentialMetadata = {
      apiKey: 'xai-expired-key',
      storedAt: now - 10 * DAY_MS,
      expiresAt: now - 3 * DAY_MS
    };

    vi.mocked(keytar.default.getPassword).mockResolvedValue(
      JSON.stringify(expiredMetadata)
    );

    const result = await CredentialStore.getKey();

    expect(result).toBeNull(); // Expired credentials return null
  });

  it('should return credential if not expired (6 days old)', async () => {
    const keytar = await import('keytar');
    const now = Date.now();

    // Credential stored 6 days ago (expires in 1 day)
    const validMetadata: CredentialMetadata = {
      apiKey: 'xai-valid-key',
      storedAt: now - 6 * DAY_MS,
      expiresAt: now + 1 * DAY_MS
    };

    vi.mocked(keytar.default.getPassword).mockResolvedValue(
      JSON.stringify(validMetadata)
    );

    const result = await CredentialStore.getKey();

    expect(result).not.toBeNull();
    expect(result!.apiKey).toBe('xai-valid-key');
  });

  it('should return credential if stored just now (0 days old)', async () => {
    const keytar = await import('keytar');
    const now = Date.now();

    const freshMetadata: CredentialMetadata = {
      apiKey: 'xai-fresh-key',
      storedAt: now,
      expiresAt: now + 7 * DAY_MS
    };

    vi.mocked(keytar.default.getPassword).mockResolvedValue(
      JSON.stringify(freshMetadata)
    );

    const result = await CredentialStore.getKey();

    expect(result).not.toBeNull();
    expect(result!.apiKey).toBe('xai-fresh-key');
  });

  it('should return null for credential expiring exactly now', async () => {
    const keytar = await import('keytar');
    const now = Date.now();

    // Credential expires exactly at current time
    const expiringMetadata: CredentialMetadata = {
      apiKey: 'xai-expiring-key',
      storedAt: now - 7 * DAY_MS,
      expiresAt: now // Expires exactly now
    };

    vi.mocked(keytar.default.getPassword).mockResolvedValue(
      JSON.stringify(expiringMetadata)
    );

    const result = await CredentialStore.getKey();

    expect(result).toBeNull(); // At or past expiration = expired
  });

  it('should handle invalid JSON metadata gracefully', async () => {
    const keytar = await import('keytar');

    vi.mocked(keytar.default.getPassword).mockResolvedValue(
      'invalid-json-{{'
    );

    const result = await CredentialStore.getKey();

    expect(result).toBeNull();
    // Should also delete invalid metadata
    expect(keytar.default.deletePassword).toHaveBeenCalled();
  });

  it('should migrate legacy credential to metadata format', async () => {
    const keytar = await import('keytar');

    // First call: no metadata
    // Second call: legacy key exists
    vi.mocked(keytar.default.getPassword)
      .mockResolvedValueOnce(null) // No metadata
      .mockResolvedValueOnce('xai-legacy-key'); // Legacy key exists

    const consoleSpy = vi.spyOn(console, 'log');

    const result = await CredentialStore.getKey();

    // Should trigger migration
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Migrating credential')
    );

    consoleSpy.mockRestore();
  });

  describe('getStatus()', () => {
    it('should return days remaining for valid credential', async () => {
      const keytar = await import('keytar');
      const now = Date.now();

      const metadata: CredentialMetadata = {
        apiKey: 'xai-test',
        storedAt: now - 3 * DAY_MS, // 3 days ago
        expiresAt: now + 4 * DAY_MS  // 4 days remaining
      };

      vi.mocked(keytar.default.getPassword).mockResolvedValue(
        JSON.stringify(metadata)
      );

      const status = await CredentialStore.getStatus();

      expect(status.exists).toBe(true);
      expect(status.expired).toBe(false);
      expect(status.daysRemaining).toBe(4);
    });

    it('should return expired status for old credential', async () => {
      const keytar = await import('keytar');
      const now = Date.now();

      const metadata: CredentialMetadata = {
        apiKey: 'xai-test',
        storedAt: now - 10 * DAY_MS,
        expiresAt: now - 3 * DAY_MS // Expired 3 days ago
      };

      vi.mocked(keytar.default.getPassword).mockResolvedValue(
        JSON.stringify(metadata)
      );

      const status = await CredentialStore.getStatus();

      expect(status.exists).toBe(true);
      expect(status.expired).toBe(true);
      expect(status.daysRemaining).toBe(0);
    });
  });
});
```

---

#### Step 4.4: Integration Tests

**File**: `tests/integration/offline-mode.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CredentialStore } from '../../src/auth/credential-store';
import { spawn } from 'child_process';

vi.mock('../../src/auth/credential-store');

describe('Offline Mode Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start CLI in offline mode when no credential', async () => {
    vi.mocked(CredentialStore.getKey).mockResolvedValue(null);

    // Start CLI (would need to spawn process and capture output)
    const cli = spawn('node', ['dist/index.js', '--help']);

    const output = await new Promise<string>((resolve) => {
      let data = '';
      cli.stdout.on('data', (chunk) => {
        data += chunk.toString();
      });
      cli.on('close', () => resolve(data));
    });

    expect(output).toContain('grok auth login');
    expect(output).toContain('optional');
  });

  it('should handle auth commands without starting TUI', async () => {
    vi.mocked(CredentialStore.isAvailable).mockResolvedValue(true);
    vi.mocked(CredentialStore.hasKey).mockResolvedValue(true);

    const cli = spawn('node', ['dist/index.js', 'auth', 'status']);

    const output = await new Promise<string>((resolve) => {
      let data = '';
      cli.stdout.on('data', (chunk) => {
        data += chunk.toString();
      });
      cli.on('close', () => resolve(data));
    });

    expect(output).toContain('configured');
    // Should not contain TUI elements
    expect(output).not.toContain('┌'); // Box drawing character
  });
});
```

---

#### Step 4.5: Security Tests

**File**: `tests/security/no-key-leakage.test.ts` (NEW)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../../src/auth/auth-service';
import { CredentialStore } from '../../src/auth/credential-store';

vi.mock('../../src/auth/credential-store');

describe('Security: No Key Leakage', () => {
  it('should not log API key during login', async () => {
    // Spy on console methods
    const consoleSpy = vi.spyOn(console, 'log');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    vi.mocked(CredentialStore.isAvailable).mockResolvedValue(true);
    vi.mocked(CredentialStore.setKey).mockResolvedValue();

    // Verify key not in any console output
    const allLogs = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const allErrors = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');

    expect(allLogs).not.toContain('xai-');
    expect(allErrors).not.toContain('xai-');

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should not include key in error messages', async () => {
    vi.mocked(CredentialStore.setKey).mockRejectedValue(
      new Error('Failed to store xai-secret-key-123')
    );

    // This should sanitize the error message
    const result = await AuthService.login();

    expect(result.message).not.toContain('xai-secret-key');
  });

  it('should never write key to filesystem', async () => {
    // Verify no fs.writeFile calls contain API keys
    // This would require mocking fs and checking call arguments
    // Implementation depends on test strategy
  });
});
```

---

### Phase 5: Documentation (1-2 hours)

#### Step 5.1: Create/Update USAGE.md

**File**: `docs/USAGE.md`

**Add Authentication Section** (insert after installation):

```markdown
## Authentication

### First-Time Setup (Recommended Method)

grok-cli stores API keys securely in your system's credential storage (Keychain on macOS, Credential Manager on Windows, libsecret on Linux).

**Initial Setup**:
```bash
# Get your API key from https://console.x.ai/
grok auth login
```

You'll be prompted to enter your API key. Input is hidden for security.

```
? Enter your xAI API key: [hidden]
✓ Credential stored securely in system keychain
✓ AI mode will be enabled next time you run grok
```

**That's it!** Your key is now stored securely. You'll need to re-authenticate weekly for security.

### Important: Weekly Re-Authentication

**Security Policy**: Credentials expire after **7 days** and require re-login.

**Timeline**:
- Day 0: Run `grok auth login` - Credential stored
- Days 1-6: grok works in AI mode
- Day 7: Credential expires - grok switches to offline mode
- Day 8+: Must run `grok auth login` again

**Why?**: Regular re-authentication reduces the window of exposure if your keychain is compromised.

### Check Status

```bash
grok auth status
```

**Output** (valid credential):
```
✓ Credential configured (AI mode enabled)
  Provider: xAI Grok
  Stored: 2026-01-07
  Expires: 2026-01-14 (in 4 days)
  Storage: System keychain (encrypted)
```

**Output** (expired credential):
```
✗ Credential expired (offline mode)
  Last login: 2026-01-07
  Expired: 2026-01-14 (2 days ago)

  Run 'grok auth login' to re-enable AI
```

**Output** (no credential):
```
✗ No credential configured (offline mode)
ℹ️  Run 'grok auth login' to enable AI features
ℹ️  Credentials expire after 7 days for security
```

### Re-Login Process

When your credential expires:

```bash
$ grok
⚠️  OFFLINE MODE - Credential Expired
   Your credential expired. Run 'grok auth login' to re-authenticate.
   Credentials expire every 7 days for security.
   Tools available: grep, read, write, edit, glob, bash, todo

$ grok auth login
? Enter your xAI API key: [hidden]
✓ Credential stored securely in system keychain
✓ AI mode will be enabled next time you run grok
```

### Logout (Remove Credential)

```bash
grok auth logout
```

You'll be asked to confirm:
```
? Remove stored credential? (y/N) y
✓ Credential removed from system keychain
ℹ️ Offline mode will be used next time you run grok
```

### Environment Variables

Environment-variable authentication is **not supported** by design. Use `grok auth login` to store credentials securely in the system keychain. If you previously used `export GROK_API_KEY=...`, remove it from your shell profile (see Migration Guide below).

---

## Offline Mode

If no credential is configured, grok-cli runs in **offline mode**:

✅ **What works**:
- All tools: `grep`, `read`, `write`, `edit`, `glob`, `bash`, `todo`
- Full TUI (Terminal UI)
- All slash commands except AI chat
- Help system (`/help`)
- Command history

❌ **What doesn't work**:
- AI chat
- Model switching (no models available)
- AI conversation history

**Enabling AI**: Run `grok auth login` to store your credential and enable AI features.

---

## In-TUI Authentication

You can also manage credentials from within the TUI:

```
TUI> /auth login
[Prompts for API key]

TUI> /auth status
✓ Credential configured

TUI> /auth logout
? Remove stored credential? (y/N)
```

**Note**: Changes take effect after restarting grok.

---

## Troubleshooting

### "System keychain unavailable"

This error means the `keytar` native module failed to load. This can happen if:
- Build tools (node-gyp, Python) are not installed
- Prebuilt binaries are not available for your platform

**Solutions**:

1. **Install build tools**:
   ```bash
   # macOS
   xcode-select --install

   # Ubuntu/Debian
   sudo apt install build-essential libsecret-1-dev

   # Windows
   npm install --global windows-build-tools
   ```

2. **Rebuild keytar**:
   ```bash
   cd /path/to/grok-cli
   npm rebuild keytar
   ```

3. **No insecure fallbacks**:
   If keytar can't be installed/loaded, AI mode cannot be enabled. grok-cli remains fully usable in offline/tool-only mode.

### "AI disabled (no credentials)"

You're in offline mode. Run:
```bash
grok auth login
```

### "Neither ripgrep nor grep is installed"

See [Grep Tool Requirements](#grep-tool-requirements) in the main USAGE doc.

---

## Security Notes

- API keys are **never** written to files (no `.env`, no config files)
- Keys are stored using OS-level encryption (Keychain, Credential Manager, etc.)
- Keys are **not** logged to console or error messages
- Hidden input when entering keys (no echo to terminal)
- Keys persist **across terminal sessions** and **directories** - set once, works everywhere

For security questions or to report vulnerabilities, see [SECURITY.md](../SECURITY.md).
```

---

#### Step 5.2: Update README.md

**File**: `README.md` (if exists, or create)

**Replace** any "export GROK_API_KEY" instructions with:

**OLD**:
```markdown
## Setup

1. Install grok-cli
2. Export your API key:
   ```bash
   export GROK_API_KEY=xai-your-key-here
   ```
3. Run grok
```

**NEW**:
```markdown
## Quick Start

1. **Install** grok-cli:
   ```bash
   npm install -g grok-cli
   ```

2. **Store your API key** (one-time setup):
   ```bash
   grok auth login
   ```

   Enter your xAI API key when prompted. Get your key from: https://console.x.ai/

3. **Run** grok:
   ```bash
   grok
   ```

**That's it!** Your key is stored securely. Re-authenticate weekly for security.

---

## Features

- 🤖 **Offline-First**: Works without API keys for local tools (grep, read, write, etc.)
- 🔐 **Secure Storage**: API keys stored in system keychain (Keychain/Credential Manager)
- 🔄 **Weekly Re-Auth**: Credentials expire after 7 days for enhanced security
- 🚀 **Zero Config**: Set credential once with `grok auth login`, works everywhere
- 🛠️ **Powerful Tools**: grep, read, write, edit, glob, bash, todo
- 💬 **AI Chat**: Optional AI mode when credential configured
- 🎨 **Beautiful TUI**: Ink-based Terminal UI

> **Security Note**: Credentials expire weekly. Run `grok auth status` to check expiration.

---

## Offline Mode

grok-cli works without an API key in **offline mode**:

```bash
# No API key needed for tools
grok grep "pattern" ./src
grok read ./path/to/file.txt
```

To enable AI features, run `grok auth login`.

See [USAGE.md](docs/USAGE.md) for full documentation.
```

---

## E. Verification & Acceptance Criteria

### E1. Functional Tests

| Test | Command | Expected Outcome | Status |
|------|---------|------------------|--------|
| Help without key | `grok --help` | Shows help with auth commands, no error | [ ] |
| Start without key | `grok` | Shows offline banner, tools available | [ ] |
| Auth login | `grok auth login` | Prompts for key, stores in keychain | [ ] |
| Auth status (configured) | `grok auth status` | Shows "AI mode enabled" | [ ] |
| Start with key | `grok` (after login) | AI mode, no offline banner | [ ] |
| Offline tool use | `grok grep "test"` (no key) | Tool works, shows offline mode | [ ] |
| /model offline | `/model` (in TUI, no key) | Shows "AI disabled" | [ ] |
| /auth login in TUI | `/auth login` (in TUI) | Prompts, stores, says "restart" | [ ] |
| Auth logout | `grok auth logout` | Removes key, confirms | [ ] |
| Login sets 7-day TTL | `grok auth login` | Metadata has expiresAt = now + 7 days | [ ] |
| Status shows expiration | `grok auth status` | Shows "Expires: [date] (in X days)" | [ ] |
| Expired credential = offline | Set clock +8 days, `grok` | Shows "Credential expired" banner | [ ] |
| Fresh credential = AI mode | After login, `grok` | AI mode, no expiry warning | [ ] |
| Re-login resets TTL | Login twice, check TTL | Second login resets 7-day timer | [ ] |

### E2. Security Validation

| Check | Method | Expected | Status |
|-------|--------|----------|--------|
| No key in logs | Review console output during auth | No `xai-` visible | [ ] |
| No key in errors | Trigger errors with key set | Key not in error text | [ ] |
| No key in files | Search repo for `.env`, configs | No keys stored | [ ] |
| No network in offline | Mock OpenAI, run offline | Zero API calls | [ ] |
| Keychain encryption | Check OS keychain tool | Encrypted entry exists | [ ] |
| Hidden input | Run `grok auth login` | Characters not echoed | [ ] |
| Metadata stored securely | Check keychain entry | JSON metadata encrypted | [ ] |
| No TTL bypass | Try to extend TTL manually | Fails, must re-login | [ ] |
| Expired key not used | Verify GrokClient not init | Zero API calls with expired key | [ ] |

### E3. Cross-Platform Tests

| Platform | Test | Status |
|----------|------|--------|
| macOS | Full flow (login/logout/status) | [ ] |
| Windows | Full flow | [ ] |
| Linux (Ubuntu) | Full flow | [ ] |

### E4. Regression Tests

| Test | Expected | Status |
|------|----------|--------|
| All 69 existing tests pass | `npm test -- --run` | [ ] |
| Grep tool works offline | `grok grep "test"` | [ ] |
| Path validator enforced | Try blocked path | [ ] |
| Security fixes intact | Re-run security tests | [ ] |

---

## F. Migration Guide for Existing Users

### Current Workflow (To Be Replaced)

```bash
# Every time you open a terminal:
export GROK_API_KEY=xai-abc123...

# In new directory:
cd ~/projects/other-project
export GROK_API_KEY=xai-abc123...  # Again!

grok
```

### New Workflow (One-Time Setup)

```bash
# ONE TIME ONLY:
grok auth login
[Enter key: xai-abc123...]

# Then forever:
cd ~/any/directory
grok  # Just works!
```

### Migration Steps

1. **One-Time Setup**:
   ```bash
   grok auth login
   ```

2. **Remove from shell profile**:
   Edit `~/.bashrc`, `~/.zshrc`, or `~/.bash_profile`:

   **Remove these lines**:
   ```bash
   export GROK_API_KEY=xai-...
   export XAI_API_KEY=xai-...
   ```

3. **Done!** grok-cli now works everywhere without exports.

### CI/CD Note

AI mode requires interactive `grok auth login` and OS keychain storage. In typical CI environments, AI mode should be considered **unavailable**; run grok-cli in offline/tool-only mode for CI tasks.

---

## G. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| keytar build fails | Medium | Medium | Clear install instructions; stay in offline/tool-only mode until keytar loads |
| Breaking change for existing users | High | Medium | Migration guide: remove exports; require `grok auth login` + keychain |
| Key extraction by malware | Low | High | OS-level encryption, follows platform security practices |
| Offline mode confusing | Medium | Low | Clear banner, helpful messages, comprehensive docs |
| Performance (keychain read) | Low | Low | Cache key in memory after first read, only read once per CLI start |
| Users lose API key | Low | Medium | Document where keys are stored, provide status command |
| Weekly re-login annoying | Medium | Low | Clear expiration message, simple re-login process, security benefit explained |
| Users forget credential expired | Medium | Low | Clear "Credential expired" banner on startup, status shows days remaining |
| Clock manipulation bypass | Very Low | Low | Server-side rate limiting still applies, TTL is convenience not sole security |

---

## H. Implementation Timeline

**Total Estimated Effort**: 12-16 hours implementation + 4-6 hours testing = **16-22 hours**

*(Updated to include TTL/expiration logic - adds ~2 hours)*

| Phase | Tasks | Est. Time | Dependencies | Notes |
|-------|-------|-----------|--------------|-------|
| 1 | Credential storage with TTL (keytar, metadata, expiration) | 4-5 hrs | None | +1hr for metadata/TTL logic |
| 2 | Command integration (auth handler, routing) | 2-3 hrs | Phase 1 | |
| 3 | Conditional AI init (App, index, TTL check, offline mode) | 2-3 hrs | Phases 1-2 | Includes expiration checking |
| 4 | Testing (unit, integration, TTL logic, security) | 4-5 hrs | Phases 1-3 | +1hr for TTL-specific tests |
| 5 | Documentation (USAGE, README, weekly re-auth, migration) | 1-2 hrs | Phase 4 | Include expiration docs |
| 6 | Cross-platform testing (macOS/Win/Linux) | 2-3 hrs | Phase 5 | |
| 7 | Final verification & polish | 1-2 hrs | Phase 6 | |

**Critical Path**: Phase 1 → Phase 3 → Phase 4 → Phase 6

**Parallelization Opportunities**:
- Phase 2 (commands) can overlap with Phase 3 (UI changes)
- Phase 5 (docs) can start during Phase 4 (testing)

**TTL-Specific Tasks** (included in phases above):
- Phase 1: CredentialMetadata interface, expiresAt calculation, getStatus() method
- Phase 3: Startup expiration check, expired credential banner
- Phase 4: 7 new TTL tests (credential-ttl.test.ts)
- Phase 5: Weekly re-authentication documentation

---

## I. Future Enhancements (Post-Implementation)

### I1. Local LLM Support (No Keys)

Add support for local LLM backends (Ollama, LM Studio) that don't require API keys:

```bash
grok auth login --local http://localhost:11434
```

Uses OpenAI-compatible API, no key needed.

### I2. Multi-Profile Support

Support multiple credentials (work/personal):

```bash
grok auth login --profile work
grok auth login --profile personal
grok auth switch personal
```

### I3. Key Rotation

Automated key rotation:

```bash
grok auth rotate
[Prompts for new key, validates, stores, invalidates old]
```

### I4. Credential Sharing (Team)

Team-wide credential management:

```bash
grok auth import --team company.json
```

(Requires server-side support)

---

## J. Appendix: Technical Decisions

### J1. Why keytar over alternatives?

**Alternatives considered**:
- `node-keychain`: macOS-only
- `@napi-rs/keyring`: Rust-based, smaller but less battle-tested
- `credential-store`: Various packages, inconsistent maintenance

**keytar chosen because**:
- Used by Microsoft (VS Code), GitHub (Atom), proven at scale
- Cross-platform support verified on all 3 major OS
- Simple API, good TypeScript types
- Active maintenance (backed by VS Code team)
- Prebuilt binaries available for most platforms

### J2. Why not use config file encryption?

**Option**: Encrypt API key in `~/.grok/config.json`

**Rejected because**:
- Requires password/passphrase (worse UX)
- Key derivation adds latency
- Doesn't leverage OS security features
- Harder to secure against key extraction

**OS keychain better because**:
- Zero-latency access (OS handles encryption)
- Leverages platform security (Secure Enclave on macOS, etc.)
- Standard approach (VS Code, GitHub CLI, etc. all use it)
- No plaintext key file even when encrypted

### J3. Why env vars are not supported

**Decision**: Do **not** support API keys via environment variables (e.g. `GROK_API_KEY`, `XAI_API_KEY`).

**Rationale**:
- **Reduce accidental exposure**: env vars can leak via process listings, crash dumps, shell history, or inherited environments.
- **Consistent policy**: avoid "multiple credential sources" ambiguity; `grok auth login` is the single supported path.
- **Prevent insecure workflows**: eliminates recurring `export ...` patterns and CI key-in-env anti-patterns.

**Result**: AI mode is available only when a valid, unexpired credential exists in the system keychain. Otherwise grok-cli runs in offline/tool-only mode.

### J4. Why Strict 7-Day Expiration (Option A)?

**Decision**: Strict weekly expiration with NO auto-extension

**Option A (CHOSEN): Strict Weekly**
- Credentials expire exactly 7 days after login
- Never auto-extend, even if API used daily
- User must run `grok auth login` after expiration

**Option B (REJECTED): Rolling Weekly**
- Successful API call extends TTL by 7 days
- Could persist indefinitely if used daily
- More complex, harder to reason about

**Rationale for Option A**:
- **Simpler**: Fixed expiration time, predictable
- **More secure**: Forces regular re-authentication regardless of usage
- **Clearer UX**: Users know exactly when credential expires
- **Easier to implement**: No API call tracking needed
- **Standard practice**: Similar to sudo timeout (fixed window)

**Trade-off**: Users who use grok daily must re-login weekly (minor inconvenience for security benefit)

**TTL Configuration**:
```typescript
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000 ms = 7 days

// On login:
const expiresAt = Date.now() + TTL_MS;

// On startup:
if (Date.now() >= metadata.expiresAt) {
  // Expired - offline mode
}
```

**Future Consideration**: If TTL needs to be configurable, do it via a code-level configuration change (not environment variables) and keep the default strict 7-day policy.

---

**PRP Status**: ✅ Ready for Execution
**Author**: Claude Dev Team
**Requires Approval**: Yes (architectural change)
**Review Date**: 2026-01-14

---

**END OF PRP**
