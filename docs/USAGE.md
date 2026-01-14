# grok-cli Usage Guide

## Prerequisites

### Required Dependencies

#### 1. Node.js
- Minimum version: 18.0.0
- Install: https://nodejs.org/

#### 2. Search Tool (ripgrep OR grep)

grok-cli uses external search tools for file searching functionality. At least one of the following must be installed:

**Option A: ripgrep (Recommended)**

ripgrep (`rg`) is a fast, feature-rich search tool and is the preferred option for grok-cli.

**Installation**:

| Platform | Command |
|----------|---------|
| macOS (Homebrew) | `brew install ripgrep` |
| Ubuntu/Debian | `sudo apt install ripgrep` |
| Fedora/RHEL | `sudo dnf install ripgrep` |
| Arch Linux | `sudo pacman -S ripgrep` |
| Windows (Chocolatey) | `choco install ripgrep` |
| Windows (Scoop) | `scoop install ripgrep` |
| Windows (winget) | `winget install BurntSushi.ripgrep.MSVC` |
| Cargo (Rust) | `cargo install ripgrep` |

Or download binaries from: https://github.com/BurntSushi/ripgrep/releases

**Option B: grep (Fallback)**

If ripgrep is not available, grok-cli will automatically fall back to using `grep`.

Most Unix-like systems (Linux, macOS) have `grep` pre-installed. On Windows, `grep` is available through:
- Git Bash (comes with Git for Windows)
- WSL (Windows Subsystem for Linux)
- Cygwin
- MinGW/MSYS2

**Note**: The grep fallback has reduced functionality compared to ripgrep (e.g., no automatic color support, slower performance on large codebases).

---

## Installation

```bash
# Clone the repository
git clone https://github.com/airplne/grok-cli.git
cd grok-cli

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

---

## Basic Usage

```bash
# Run from source (dev)
npm run dev

# Or build and run
npm run build
node dist/index.js

# Or link globally and run as `grok`
npm link
grok --help
grok "Hello, what can you do?"
```

---

## Search Tool (rg/grep)

When the assistant needs to search files (e.g., "find where X is defined"), grok-cli uses ripgrep (`rg`) if available, and falls back to `grep`.

There is no separate `grok search` subcommand; search happens via the assistant's Grep tool.

---

## Troubleshooting

### "Neither ripgrep (rg) nor grep is installed" Error

This error means neither `rg` nor `grep` were found on your system PATH.

**Solution**:
1. Install ripgrep (recommended) using the commands above, or ensure grep is available
2. Verify installation:
   ```bash
   # Check for ripgrep
   rg --version

   # Or check for grep
   grep --version
   ```
3. Restart your terminal/shell to refresh PATH
4. Try running `grok` again

**If the error persists**, ensure the tool is in your PATH:
```bash
# Check PATH (Unix/Linux/macOS)
echo $PATH

# Check PATH (Windows CMD)
echo %PATH%

# Check PATH (Windows PowerShell)
$env:PATH
```

### Search Returns No Results

1. Verify the search path exists and contains files
2. Check that the pattern is correct (regex syntax)
3. Ensure you have read permissions on the target directory

### Permission Denied Errors

grok-cli validates file paths for security. Certain paths are blocked:
- System directories (`/etc/passwd`, `/proc`, etc.)
- Hidden credential files (`.env`, `.ssh/id_rsa`, etc.)
- Paths outside allowed directories

If you need to access a blocked path, review the security policy in the project documentation.

---

## Security

grok-cli implements several security measures:

- **Path validation**: All file paths are validated and sanitized before access
- **Pattern injection prevention**: Search patterns are properly escaped with `--` separator
- **Symlink protection**: Malicious symlinks are detected and blocked
- **Environment file protection**: Sensitive files (`.env`, `.ssh`, credentials) are blocked by default

Template files (`.env.example`, `.env.sample`, `.env.template`) are allowed for **read-only** access.

For security-related questions or to report vulnerabilities, please contact the maintainers.

---

## Getting Help

- Check the [issues page](https://github.com/airplne/grok-cli/issues) for known problems
- File a bug report if you encounter unexpected behavior
- Include your OS, Node.js version, and search tool version in bug reports

---

*Last updated: 2026-01-13*
