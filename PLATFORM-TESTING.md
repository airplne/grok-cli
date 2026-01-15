# Cross-Platform Testing Guide

Platform-specific testing checklist for grok-cli offline-first implementation.

---

## Overview

grok-cli uses **keytar** for secure credential storage, which requires platform-specific native modules. This guide provides testing procedures for macOS, Windows, and Linux.

---

## macOS Testing

### Prerequisites

**System Requirements**:
- macOS 10.12 Sierra or later
- Xcode Command Line Tools

**Install build tools**:
```bash
xcode-select --install
```

### Keychain Integration

**Keychain mechanism**: macOS Keychain Access
**Storage location**: `~/Library/Keychains/login.keychain-db`
**Service name**: `grok-cli`
**Account name**: `api-key-metadata`

### Testing Checklist

#### ✅ Installation
- [ ] `npm install -g grok-cli` succeeds
- [ ] keytar native module builds successfully
- [ ] No build warnings related to keychain

#### ✅ Authentication
- [ ] `grok auth login` prompts for API key (hidden input)
- [ ] API key stored in Keychain Access (verify manually)
- [ ] `grok auth status` shows "Credential configured"
- [ ] Credential persists after terminal restart
- [ ] Credential works across different directories

#### ✅ Expiration
- [ ] `grok auth status` shows correct expiration date (7 days)
- [ ] Days remaining calculated correctly
- [ ] Mock expiration test (manually edit expiresAt to past date)
- [ ] Expired credential triggers offline mode

#### ✅ Offline Mode
- [ ] `grok` starts without credential (offline banner shown)
- [ ] All tools work (grep, read, write, edit, glob, bash, todo)
- [ ] AI prompts show "offline mode" helper message
- [ ] `/auth login` works from within TUI

#### ✅ Security
- [ ] API key not visible in process list (`ps aux | grep grok`)
- [ ] API key not in shell history
- [ ] Input hidden during `grok auth login`
- [ ] Keychain requires authentication to view stored key

#### ✅ Logout
- [ ] `grok auth logout` prompts for confirmation
- [ ] `grok auth logout --force` skips confirmation
- [ ] Credential removed from Keychain Access
- [ ] Subsequent `grok` starts in offline mode

### Manual Keychain Verification

**View stored credential**:
1. Open "Keychain Access" app
2. Search for "grok-cli"
3. Double-click entry
4. Click "Show password" (requires authentication)
5. Verify JSON format: `{"apiKey":"xai-...","storedAt":...,"expiresAt":...}`

### Known Issues (macOS)

- **Issue**: "xcrun: error: invalid active developer path"
  - **Cause**: Xcode Command Line Tools not installed
  - **Fix**: Run `xcode-select --install`

- **Issue**: Keychain permission prompt on first `grok auth login`
  - **Expected**: macOS prompts for keychain access
  - **Action**: Click "Allow" or "Always Allow"

---

## Windows Testing

### Prerequisites

**System Requirements**:
- Windows 10 or later
- Node.js 14+ with npm
- Visual Studio Build Tools

**Install build tools**:
```powershell
npm install --global windows-build-tools
```

**Alternative (manual)**:
1. Install Visual Studio 2019 or later
2. Include "Desktop development with C++" workload

### Credential Manager Integration

**Storage mechanism**: Windows Credential Manager
**Storage type**: Generic Credential
**Target name**: `grok-cli:api-key-metadata`

### Testing Checklist

#### ✅ Installation
- [ ] `npm install -g grok-cli` succeeds
- [ ] keytar builds native module (node-gyp)
- [ ] No Visual C++ build errors

#### ✅ Authentication
- [ ] `grok auth login` prompts for API key
- [ ] Credential stored in Credential Manager
- [ ] Verify in Control Panel → Credential Manager → Windows Credentials
- [ ] Credential persists after reboot

#### ✅ Credential Manager Verification
- [ ] Open Control Panel → Credential Manager
- [ ] Find "Generic Credentials" section
- [ ] Look for `grok-cli:api-key-metadata`
- [ ] Right-click → "Remove" to test logout

#### ✅ PowerShell & CMD
- [ ] Works in PowerShell
- [ ] Works in CMD
- [ ] Works in Windows Terminal
- [ ] Works in Git Bash (if installed)

#### ✅ Offline Mode
- [ ] Offline banner displays correctly in all shells
- [ ] Tools work without credential
- [ ] Re-authentication flow works

### Known Issues (Windows)

- **Issue**: "MSBuild.exe not found"
  - **Cause**: Visual C++ build tools missing
  - **Fix**: Install windows-build-tools or Visual Studio

- **Issue**: "python not found" during keytar build
  - **Cause**: Node.js build requires Python
  - **Fix**: Install Python 2.7 or 3.x, add to PATH

- **Issue**: Credential Manager requires admin for first access
  - **Expected**: Windows may prompt for elevation
  - **Action**: Run as administrator once, then works normally

---

## Linux Testing

### Prerequisites

**System Requirements**:
- Linux distribution with D-Bus and libsecret
- build-essential package
- libsecret-1-dev package

**Install build tools**:

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install build-essential libsecret-1-dev
```

**Fedora/RHEL**:
```bash
sudo dnf install @development-tools libsecret-devel
```

**Arch Linux**:
```bash
sudo pacman -S base-devel libsecret
```

### Secret Service Integration

**Storage mechanism**: libsecret (GNOME Keyring or KWallet)
**D-Bus service**: `org.freedesktop.secrets`
**Collection**: `login` (default)
**Label**: `grok-cli (api-key-metadata)`

### Testing Checklist

#### ✅ Installation
- [ ] `npm install -g grok-cli` succeeds
- [ ] keytar native module builds
- [ ] libsecret detected correctly
- [ ] No `libsecret-1.so` missing errors

#### ✅ Desktop Environment Compatibility
- [ ] **GNOME** - Uses gnome-keyring
- [ ] **KDE Plasma** - Uses kwallet
- [ ] **XFCE** - Uses gnome-keyring (if installed)
- [ ] **Headless** - May require `gnome-keyring-daemon` manual start

#### ✅ Authentication
- [ ] `grok auth login` works in terminal
- [ ] Credential stored in keyring
- [ ] Persists after logout/login
- [ ] Works across SSH sessions (if keyring forwarded)

#### ✅ Keyring Access
- [ ] **GNOME**: Use Seahorse to view stored secrets
  ```bash
  seahorse
  # Navigate to: Passwords → login → grok-cli
  ```

- [ ] **KDE**: Use KWalletManager to view
  ```bash
  kwalletmanager5
  # Navigate to: Folder "grok-cli"
  ```

#### ✅ Headless Server Testing
- [ ] Start gnome-keyring daemon manually:
  ```bash
  eval $(gnome-keyring-daemon --start)
  export $(gnome-keyring-daemon --start | grep SSH_AUTH_SOCK)
  ```
- [ ] `grok auth login` works
- [ ] Credential persists while daemon running
- [ ] Graceful fallback to offline if daemon not running

### Known Issues (Linux)

- **Issue**: "Cannot autolaunch D-Bus without X11"
  - **Cause**: Headless environment without D-Bus
  - **Fix**: Start gnome-keyring-daemon manually (see above)
  - **Alternative**: Use offline mode only

- **Issue**: "The name org.freedesktop.secrets was not provided"
  - **Cause**: No keyring daemon running
  - **Fix**: Install and start gnome-keyring or kwallet
  ```bash
  sudo apt install gnome-keyring
  gnome-keyring-daemon --start --components=secrets
  ```

- **Issue**: libsecret-1.so.0 not found
  - **Cause**: Runtime library not installed
  - **Fix**: `sudo apt install libsecret-1-0`

- **Issue**: Permission denied accessing keyring
  - **Cause**: D-Bus session not initialized
  - **Fix**: Restart session or export D-Bus address:
  ```bash
  export $(dbus-launch)
  ```

---

## CI/CD Testing

### GitHub Actions (Linux)

**Recommended**: Use offline mode only (no keychain in CI)

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run tests
        run: npm test

      # Offline mode testing
      - name: Test offline mode
        run: |
          node dist/index.js --help
          node dist/index.js --version
```

**Note**: Do NOT attempt `grok auth login` in CI. Use offline mode for tool-only testing.

---

## Docker Testing

**Note**: Docker containers typically don't have access to host keyring.

**Dockerfile for offline testing**:
```dockerfile
FROM node:18-alpine

RUN apk add --no-cache build-base libsecret-dev

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Test offline mode
CMD ["node", "dist/index.js", "--help"]
```

**Testing**:
```bash
docker build -t grok-cli-test .
docker run grok-cli-test
```

**Expected**: Offline mode banner, tools available.

---

## Cross-Platform Verification Matrix

| Feature | macOS | Windows | Linux (GNOME) | Linux (KDE) | Headless |
|---------|-------|---------|---------------|-------------|----------|
| keytar build | ✅ | ✅ | ✅ | ✅ | ✅ |
| Credential storage | ✅ | ✅ | ✅ | ✅ | ⚠️ Manual |
| Persistence | ✅ | ✅ | ✅ | ✅ | ⚠️ Daemon |
| Offline mode | ✅ | ✅ | ✅ | ✅ | ✅ |
| TTL enforcement | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hidden input | ✅ | ✅ | ✅ | ✅ | ✅ |

**Legend**:
- ✅ Full support
- ⚠️ Requires manual setup
- ❌ Not supported

---

## Testing Summary Template

Use this template to document testing results:

```markdown
## Test Report: [Platform]

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Platform**: [OS Name + Version]
**Node.js**: [Version]

### Build
- [ ] npm install succeeds
- [ ] keytar builds native module
- [ ] No build errors

### Functionality
- [ ] grok auth login works
- [ ] grok auth status shows correct info
- [ ] grok auth logout removes credential
- [ ] Credential persists across sessions
- [ ] Offline mode works without credential
- [ ] 7-day TTL enforced correctly

### Issues Found
[List any issues encountered]

### Notes
[Additional observations]
```

---

## Quick Testing Script

Run this script on each platform to verify basic functionality:

```bash
#!/bin/bash
echo "=== grok-cli Platform Test ==="
echo ""

echo "1. Build check"
npm run build && echo "✓ Build succeeds" || echo "✗ Build failed"
echo ""

echo "2. Help test"
node dist/index.js --help > /dev/null && echo "✓ Help works" || echo "✗ Help failed"
echo ""

echo "3. Version test"
node dist/index.js --version > /dev/null && echo "✓ Version works" || echo "✗ Version failed"
echo ""

echo "4. Auth status test (expect offline)"
node dist/index.js auth status && echo "✓ Auth status works" || echo "✗ Auth status failed"
echo ""

echo "5. Test suite"
npm test && echo "✓ All tests pass" || echo "✗ Tests failed"
echo ""

echo "=== Test Complete ==="
```

**Save as**: `test-platform.sh`
**Run**: `chmod +x test-platform.sh && ./test-platform.sh`

---

**Last Updated**: 2026-01-15
**Applies to**: grok-cli v1.0.0+ (offline-first)
