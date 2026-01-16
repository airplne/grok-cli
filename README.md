# grok-cli

**Offline-first CLI for xAI Grok** - A Claude Code-style terminal interface with secure keychain authentication.

## ✨ Features

- 🔐 **Secure Keychain Storage** - API keys stored in system keychain (Keychain/Credential Manager)
- 🔄 **Weekly Re-Authentication** - Credentials expire after 7 days for enhanced security
- 🚀 **Offline-First** - Works without API keys for local tools (grep, read, write, edit, glob, bash, todo)
- 💬 **AI Chat** - Optional Grok AI integration when authenticated
- 🎨 **Beautiful TUI** - Ink-based terminal UI with React components
- 🛠️ **Powerful Tools** - File operations, search, and shell integration

---

## 🚀 Quick Start

### 1. Install

```bash
npm install -g grok-cli
```

### 2. Authenticate (One-Time Setup)

```bash
grok auth login
```

Enter your xAI API key when prompted (get one from [console.x.ai](https://console.x.ai/)).

### 3. Run

```bash
grok
```

**That's it!** Your credential is stored securely and works across all terminal sessions and directories.

---

## 🔐 Security Model

### Keychain-Only Authentication

- ✅ **Credentials stored in system keychain** (encrypted by OS)
- ✅ **7-day expiration** (weekly re-authentication required)
- ✅ **No environment variables** (no `export GROK_API_KEY`)
- ✅ **No config files** (no plaintext storage)
- ✅ **Cross-platform** (macOS Keychain, Windows Credential Manager, Linux libsecret)

### Weekly Re-Authentication

For security, credentials expire after 7 days:

```bash
$ grok auth status
✓ Credential configured (AI mode enabled)
  Provider: xAI Grok
  Stored: 2026-01-07
  Expires: 2026-01-14 (in 3 days)
  Storage: System keychain (encrypted)
```

After expiration, run `grok auth login` to re-authenticate.

---

## 📖 Usage

### Auth Commands

```bash
# Store API key (one-time setup)
grok auth login

# Check credential status and expiration
grok auth status

# Remove stored credential
grok auth logout

# Remove without confirmation prompt
grok auth logout --force
```

> **Security Note**: Login is TTY-only. Piping or redirecting credentials via stdin is refused for security.

### CLI Usage

```bash
# Interactive mode (with AI if authenticated)
grok

# Interactive mode (offline - tools only)
grok  # No credential configured

# Direct prompt
grok "explain this error message"

# Show help
grok --help

# Show version
grok --version
```

### Offline Mode

When no credential is configured, grok-cli runs in **offline mode**:

✅ **Available in offline mode:**
- All file tools: `grep`, `read`, `write`, `edit`, `glob`
- Shell integration: `bash`, `todo`
- Help and commands: `/help`, `/exit`, `/clear`
- Auth commands: `/auth login`, `/auth status`

❌ **Not available in offline mode:**
- AI chat and completions
- Model switching
- AI conversation history

**Enable AI**: Run `grok auth login` to store your credential.

---

## 🛠️ Installation & Setup

### Prerequisites

**For secure credential storage (keytar):**

- **macOS**: Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```

- **Linux** (Ubuntu/Debian):
  ```bash
  sudo apt install build-essential libsecret-1-dev
  ```

- **Windows**:
  ```bash
  npm install --global windows-build-tools
  ```

### Install grok-cli

```bash
npm install -g grok-cli
```

### First-Time Authentication

```bash
grok auth login
```

Enter your xAI API key (starts with `xai-`).

**Get an API key**: [https://console.x.ai/](https://console.x.ai/)

---

## 📚 Documentation

- **[USAGE.md](./USAGE.md)** - Comprehensive usage guide
- **[MIGRATION.md](./MIGRATION.md)** - Upgrading from environment variable approach
- **[GROK.md](./GROK.md)** - Project context and development guide

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build
npm run build
```

---

## 🤝 Contributing

Contributions welcome! Please ensure:
- All tests pass (`npm test`)
- TypeScript compiles without errors (`npm run build`)
- Code follows existing patterns (see [GROK.md](./GROK.md))

---

## 📝 License

[MIT](./LICENSE)

---

## 🔒 Security

- **No credentials in files**: API keys never written to `.env`, config files, or logs
- **OS-level encryption**: Keychain/Credential Manager handles encryption
- **Hidden input**: API key entry never echoes to terminal
- **Weekly expiration**: Forced re-authentication every 7 days

**Report security issues**: Open an issue with the `security` label.

---

## Troubleshooting

### Keychain Setup Issues

If `grok auth login` fails with "System keychain unavailable":

```bash
# Run diagnostics
grok auth doctor

# Follow the platform-specific remediation steps shown
# Then try login again
grok auth login
```

**Common causes**:
- Missing build tools (gcc, make, etc.)
- Missing libsecret-1-dev (Linux)
- Missing Xcode Command Line Tools (macOS)

---

**Made with ❤️ using xAI Grok**
