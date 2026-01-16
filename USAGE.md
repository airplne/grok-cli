# grok-cli Usage Guide

Comprehensive documentation for grok-cli - offline-first CLI for xAI Grok.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Offline Mode](#offline-mode)
3. [Interactive Mode](#interactive-mode)
4. [Command Reference](#command-reference)
5. [Troubleshooting](#troubleshooting)

---

## Authentication

### First-Time Setup

grok-cli uses **keychain-only authentication** for security:

```bash
grok auth login
```

**Prompt**:
```
? Enter your xAI API key: [hidden input]
✓ Credential stored securely in system keychain
✓ AI mode will be enabled next time you run grok
ℹ️  Credential expires after 7 days for security
```

**Get an API key**: [https://console.x.ai/](https://console.x.ai/)

---

### Weekly Re-Authentication

**Security Policy**: Credentials expire after **7 days**.

#### Timeline

| Day | Status | Action |
|-----|--------|--------|
| Day 0 | `grok auth login` → Stored | Credential active for 7 days |
| Days 1-6 | AI mode active | Full functionality |
| Day 7 | Credential expires | CLI switches to offline mode |
| Day 8+ | Offline mode | Run `grok auth login` to re-enable AI |

#### Why Weekly Expiration?

- **Security**: Reduces credential exposure window
- **Predictable**: Know exactly when re-login needed
- **Simple**: No auto-extension logic - just re-login when expired

---

### Check Status

```bash
grok auth status
```

**Output examples**:

**Valid credential:**
```
✓ Credential configured (AI mode enabled)
  Provider: xAI Grok
  Stored: 2026-01-07
  Expires: 2026-01-14 (in 4 days)
  Storage: System keychain (encrypted)
```

**Expired credential:**
```
✗ Credential expired (offline mode)
  Last login: 2026-01-07
  Expired: 2026-01-14 (2 days ago)

  Run 'grok auth login' to re-enable AI
```

**No credential:**
```
✗ No credential configured (offline mode)
ℹ️  Run 'grok auth login' to enable AI features
ℹ️  Credentials expire after 7 days for security
```

---

### Logout

```bash
# Remove credential (with confirmation)
grok auth logout

# Remove without confirmation
grok auth logout --force
```

**Output**:
```
✓ Credential removed from system keychain
ℹ️  Offline mode will be used next time you run grok
```

---

## Offline Mode

When no credential is configured or credential has expired, grok-cli runs in **offline mode**.

### What Works in Offline Mode

✅ **All file tools:**
- `grep` - Search file contents
- `read` - Read files
- `write` - Create files
- `edit` - Edit files
- `glob` - Find files by pattern

✅ **Shell & utilities:**
- `bash` - Execute shell commands
- `todo` - Task management

✅ **Commands:**
- `/help` - Show help
- `/auth login` - Enable AI mode
- `/auth status` - Check credential status
- `/clear` - Clear screen
- `/exit` - Exit CLI

### What Doesn't Work

❌ **AI features:**
- AI chat completions
- Model switching (`/model`)
- AI conversation history (`/history`)

---

### Offline Mode Banner

When starting grok-cli without a credential:

```
ℹ️  OFFLINE MODE (No AI)
   Run 'grok auth login' to enable AI features.
   Tools available: grep, read, write, edit, glob, bash, todo
```

When credential expired:

```
⚠️  OFFLINE MODE - Credential Expired
   Your credential expired. Run 'grok auth login' to re-authenticate.
   Credentials expire every 7 days for security.
   Tools available: grep, read, write, edit, glob, bash, todo
```

---

## Interactive Mode

### Starting Interactive Mode

```bash
# With AI (if authenticated)
grok

# Direct prompt
grok "explain this TypeScript error"
```

### In-TUI Commands

All commands start with `/`:

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/auth login` | Store API key (restart required) |
| `/auth logout` | Remove credential (restart required) |
| `/auth status` | Check credential status |
| `/model` | List/switch AI models (AI mode only) |
| `/history` | Show conversation history (AI mode only) |
| `/clear` | Clear screen |
| `/exit` | Exit grok-cli |

---

### Chat Behavior

**AI Mode** (authenticated):
```
You: How do I reverse a string in Python?
Grok: [AI response with code example]
```

**Offline Mode** (no credential):
```
You: How do I reverse a string in Python?
grok: AI chat disabled (offline mode)

Available commands:
  /help        - Show all commands
  /auth login  - Enable AI mode

Available tools (use /help for details):
  grep, read, write, edit, glob, bash, todo
```

---

## Command Reference

### CLI Arguments

```bash
# Show help
grok --help
grok -h

# Show version
grok --version
grok -v

# Interactive mode with initial prompt
grok "your prompt here"

# Auth commands
grok auth login
grok auth logout [--force]
grok auth status
```

### In-TUI Commands

#### /auth

```bash
/auth login   # Store API key (restart to enable AI)
/auth logout  # Remove credential (restart to disable AI)
/auth status  # Show credential status and expiration
/auth doctor  # Diagnose keychain availability
```

#### /auth doctor

**(Both CLI and TUI)**

Diagnose keychain availability and get platform-specific troubleshooting steps.

```bash
grok auth doctor

# TUI mode
/auth doctor
```

**Output examples**:

**Keychain available:**
```
Keychain Diagnostics

[OK] System keychain is available
   Platform: linux
   Node version: v18.19.0

You can use `grok auth login` to store credentials securely.
```

**Keychain unavailable (Linux):**
```
Keychain Diagnostics

[ERROR] System keychain is NOT available
   Platform: linux
   Node version: v18.19.0
   Reason: missing-native-binding

Error details:
   Cannot find module '../build/Release/keytar.node'

Remediation:

Install build tools and libsecret:
  sudo apt update
  sudo apt install -y build-essential libsecret-1-dev

Then rebuild keytar:
  cd /home/user/grok-cli
  npm rebuild keytar

After fixing, run: grok auth doctor
   Then try: grok auth login
```

Use this command to diagnose keytar issues before attempting `grok auth login`.

#### /model

**(AI mode only)**

```bash
/model        # Show current model
/model list   # List available models
/model grok-2 # Switch to grok-2 model
```

#### /history

**(AI mode only)**

```bash
/history      # Show conversation history
```

#### /help

```bash
/help         # Show all available commands
```

#### /clear

```bash
/clear        # Clear terminal screen
```

#### /exit

```bash
/exit         # Exit grok-cli
```

---

## Troubleshooting

### "System keychain unavailable"

**Cause**: `keytar` native module not built or missing system dependencies.

**Solution**:

**macOS:**
```bash
xcode-select --install
cd /path/to/grok-cli
npm rebuild keytar
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install build-essential libsecret-1-dev
cd /path/to/grok-cli
npm rebuild keytar
```

**Windows:**
```bash
npm install --global windows-build-tools
cd \path\to\grok-cli
npm rebuild keytar
```

---

### "AI disabled (no credentials)"

**Cause**: No credential stored or credential expired.

**Solution**:
```bash
grok auth status  # Check current status
grok auth login   # Store/update credential
```

---

### "Credential expired"

**Cause**: More than 7 days since last login.

**Solution**:
```bash
grok auth login
```

This resets the 7-day TTL.

---

### API Key Format Error

**Symptom**: Warning during login about key format.

**Cause**: xAI API keys typically start with `xai-`.

**Example**:
```
⚠️  Warning: API key does not start with "xai-"
   xAI API keys usually have format: xai-...
   Continuing anyway...
```

**Solution**: Verify you copied the correct key from [console.x.ai](https://console.x.ai/).

---

### Keychain Permission Denied

**Cause**: System denying access to keychain.

**macOS**: Grant "Keychain Access" permission in System Preferences → Security & Privacy

**Linux**: Ensure `gnome-keyring` or `kwallet` is running

**Windows**: Run as administrator if Credential Manager access denied

---

## Advanced Topics

### Credential Storage Location

Credentials are stored by the operating system:

| Platform | Mechanism | Location |
|----------|-----------|----------|
| macOS | Keychain Access | `/Library/Keychains/login.keychain` |
| Windows | Credential Manager | Windows Credential Vault |
| Linux | libsecret (gnome-keyring/kwallet) | Depends on desktop environment |

**Service name**: `grok-cli`
**Account name**: `api-key-metadata`

---

### Credential Metadata

Stored as JSON:
```json
{
  "apiKey": "xai-your-key",
  "storedAt": 1705276800000,
  "expiresAt": 1705881600000
}
```

**Fields**:
- `apiKey`: The actual xAI API key
- `storedAt`: UTC timestamp (ms) when stored
- `expiresAt`: UTC timestamp (ms) when expires (storedAt + 7 days)

---

### Security Best Practices

✅ **Do:**
- Use `grok auth login` for credential storage
- Re-authenticate weekly when prompted
- Run `grok auth logout` on shared machines after use
- Verify API key format (starts with `xai-`)

❌ **Don't:**
- Store API keys in files (`.env`, config, etc.)
- Share your API key with others
- Set environment variables (no longer supported)
- Disable keychain expiration (not configurable)

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/airplne/grok-cli/issues)
- **Documentation**: [README.md](./README.md)
- **Migration Guide**: [MIGRATION.md](./MIGRATION.md)
- **Project Context**: [GROK.md](./GROK.md)

---

**Last Updated**: 2026-01-14
**grok-cli version**: 2.0.0
