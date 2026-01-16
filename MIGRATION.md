# Migration Guide: Environment Variables → Keychain Authentication

Guide for upgrading from environment variable authentication to secure keychain storage.

---

## Overview

**What Changed**:
- ❌ **Removed**: `process.env.GROK_API_KEY` and `process.env.XAI_API_KEY` support
- ✅ **Added**: Keychain-only authentication via `grok auth login`
- ✅ **Added**: Offline-first mode (CLI works without credentials)
- ✅ **Added**: 7-day credential expiration for security

**Breaking Change**: This is a **major version upgrade**. Environment variables no longer work.

---

## Quick Migration (3 Steps)

### 1. Store Your Credential

```bash
grok auth login
```

Enter your API key when prompted (the same key you previously used in `GROK_API_KEY`).

### 2. Remove from Shell Profile

Edit your shell configuration file:

**Bash** (`~/.bashrc` or `~/.bash_profile`):
```bash
nano ~/.bashrc
```

**Zsh** (`~/.zshrc`):
```bash
nano ~/.zshrc
```

**Remove these lines**:
```bash
export GROK_API_KEY="xai-your-key-here"
export XAI_API_KEY="xai-your-key-here"
```

**Save and reload**:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

### 3. Verify

```bash
grok auth status
```

**Expected output**:
```
✓ Credential configured (AI mode enabled)
  Provider: xAI Grok
  Stored: 2026-01-14
  Expires: 2026-01-21 (in 7 days)
  Storage: System keychain (encrypted)
```

**Done!** You're now using secure keychain authentication.

---

## Detailed Comparison

### Before (Environment Variables)

**Setup** (every terminal session):
```bash
# In ~/.bashrc or ~/.zshrc
export GROK_API_KEY="xai-your-key-here"
```

**Workflow**:
1. Add `export GROK_API_KEY=...` to shell profile
2. Source profile or restart terminal
3. Run `grok`
4. Repeat steps 1-3 for every new directory/session

**Issues**:
- ❌ Must configure for every terminal session
- ❌ API key visible in shell history
- ❌ API key visible in process environment (`ps e`)
- ❌ API key stored in plaintext file
- ❌ No expiration (indefinite validity)

---

### After (Keychain Authentication)

**Setup** (one-time):
```bash
grok auth login
```

**Workflow**:
1. Run `grok auth login` once
2. Run `grok` from any directory
3. Re-login every 7 days when prompted

**Benefits**:
- ✅ Set once, works everywhere
- ✅ OS-level encryption (Keychain/Credential Manager)
- ✅ Hidden input (not in shell history)
- ✅ Not visible in process environment
- ✅ Automatic 7-day expiration for security
- ✅ Works offline (tools available without credentials)

---

## Migration Scenarios

### Scenario 1: Local Development Machine

**Old approach**:
```bash
# ~/.bashrc
export GROK_API_KEY="xai-dev-key-12345"
```

**New approach**:
```bash
# Remove from ~/.bashrc
grok auth login
```

**Benefit**: No more editing shell profiles. Works across all directories immediately.

---

### Scenario 2: Multiple Projects

**Old approach**:
```bash
# Project A
cd ~/projects/project-a
export GROK_API_KEY="xai-key-a"
grok

# Project B
cd ~/projects/project-b
export GROK_API_KEY="xai-key-b"  # Different key!
grok
```

**New approach**:
```bash
# Use one key for all projects
grok auth login

# Works in any directory
cd ~/projects/project-a
grok

cd ~/projects/project-b
grok  # Same credential, no re-config needed
```

**Note**: If you need different keys per project, see [Multiple Credentials](#multiple-credentials) below.

---

### Scenario 3: CI/CD Pipelines

**Old approach**:
```yaml
# .github/workflows/test.yml
env:
  GROK_API_KEY: ${{ secrets.GROK_API_KEY }}

steps:
  - run: grok test-command
```

**New approach**:

**Offline mode for tool-only usage (recommended)**:
```yaml
steps:
  - name: Run tools (no AI needed)
    run: grok grep "test pattern" ./src
```

**Note**: AI mode is **not supported** in typical CI environments. `grok auth login` is intentionally interactive (hidden input) and stores credentials in the OS keychain; it cannot be safely automated via environment variables, config files, CLI flags, or stdin/pipes.

---

### TTY-Only Login (v2.0.2+)

Login now enforces TTY mode. Attempts to pipe credentials will be refused:

```bash
# These will fail (by design):
echo "xai-key" | grok auth login  # ❌ Refused
grok auth login < keyfile.txt     # ❌ Refused

# This works:
grok auth login                   # ✅ Interactive prompt
```

---

## Common Questions

### Q: Can I still use environment variables?

**A**: No. Environment variable support has been completely removed for security reasons.

**Why removed**:
- Credentials visible in shell history
- Credentials visible in process list
- Credentials stored in plaintext files
- No expiration mechanism
- Easy to leak via logs/errors

**Alternative**: Use `grok auth login` for secure keychain storage.

---

### Q: What if keytar doesn't work on my system?

**A**: grok-cli will run in **offline-only mode**:

```
⚠️  OFFLINE MODE - System Keychain Unavailable
   Credential storage requires system dependencies.
   Install build tools to enable AI features:
     - macOS: xcode-select --install
     - Linux: sudo apt install build-essential libsecret-1-dev
     - Windows: npm install --global windows-build-tools
   Tools available: grep, read, write, edit, glob, bash, todo
```

**Solution**:
1. Install system dependencies (see above)
2. Rebuild keytar: `npm rebuild keytar`
3. Run `grok auth login`

---

### Q: How do I back up my credential?

**A**: You don't need to. Just keep your API key safe. If you lose access to your keychain:

```bash
grok auth login
```

Re-enter your API key (same one from [console.x.ai](https://console.x.ai/)).

---

### Q: Can I export my credential from the keychain?

**A**: The keychain is encrypted by the OS. You can view your API key via the system keychain tool:

**macOS**:
```bash
# Open Keychain Access app
open "/Applications/Utilities/Keychain Access.app"
# Search for "grok-cli"
```

**Windows**:
```
Control Panel → Credential Manager → Windows Credentials
Search for "grok-cli"
```

**Linux** (GNOME):
```bash
seahorse  # GNOME Keyring manager
# Search for "grok-cli"
```

**Note**: This shows the raw API key. Keep it secure.

---

### Q: What happens to my old environment variables?

**A**: They are ignored. grok-cli **only** checks the keychain now.

**Example**:
```bash
export GROK_API_KEY="xai-old-key"  # Ignored
grok  # Uses keychain credential (or offline mode if none)
```

---

### Q: Can I use different credentials for different machines?

**A**: Yes! Credentials are stored per-machine:

**Machine 1** (personal laptop):
```bash
grok auth login
# Enter: xai-personal-key
```

**Machine 2** (work desktop):
```bash
grok auth login
# Enter: xai-work-key
```

Each machine stores its own credential independently.

---

## Multiple Credentials (Advanced)

Currently, grok-cli supports **one credential per machine**.

### Workaround for Multiple Keys

If you need different API keys for different purposes:

**Option 1** - Use separate user accounts:
```bash
# User account A
su - user_a
grok auth login  # Key A

# User account B
su - user_b
grok auth login  # Key B
```

**Option 2** - Manual switching:
```bash
# Switch to key A
grok auth logout --force
grok auth login  # Enter key A

# Switch to key B
grok auth logout --force
grok auth login  # Enter key B
```

**Future Enhancement**: Multi-profile support planned for future release.

---

## Troubleshooting Migration

### Issue: "No credential configured" after migration

**Cause**: Forgot to run `grok auth login`.

**Solution**:
```bash
grok auth login
```

---

### Issue: grok still tries to use environment variable

**Cause**: Running old version of grok-cli.

**Solution**:
```bash
# Check version
grok --version

# Upgrade to latest
npm install -g grok-cli@latest

# Verify keychain-only mode
grok auth status
```

---

### Issue: API key format warning

**Symptom**:
```
⚠️  Warning: API key does not start with "xai-"
   xAI API keys usually have format: xai-...
```

**Cause**: Possible typo in API key.

**Solution**: Verify API key from [console.x.ai](https://console.x.ai/). xAI keys should start with `xai-`.

---

### Issue: Credential expires too quickly

**Symptom**: "Need to re-login every 7 days, this is annoying!"

**Explanation**: This is **intentional** for security.

**Rationale**:
- Limits credential exposure window
- Industry best practice (similar to sudo timeout)
- Balances security with convenience

**Alternative**: None. 7-day TTL is not configurable.

**Tip**: Set a calendar reminder to re-authenticate weekly.

---

## Rollback (Emergency)

If you need to temporarily rollback to environment variables:

**⚠️ Not Supported**: Environment variables have been **completely removed**. There is no rollback path.

**If you encounter issues**, please:
1. Check troubleshooting guide above
2. File an issue: [GitHub Issues](https://github.com/airplne/grok-cli/issues)
3. Use offline mode temporarily (tools still work)

---

## Summary

| Feature | Old (Env Vars) | New (Keychain) |
|---------|----------------|----------------|
| **Setup** | Per terminal session | One-time per machine |
| **Security** | Plaintext in shell | OS-level encryption |
| **Expiration** | Never | 7 days |
| **Visibility** | Process environment | Hidden |
| **Offline Mode** | N/A (always required) | Works without credentials |
| **Cross-directory** | Re-export needed | Works everywhere |

**Recommendation**: Migrate to keychain authentication for improved security and convenience.

---

**Questions?** See [USAGE.md](./USAGE.md) or file an issue.
