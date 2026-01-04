// Command Allowlist - Defense-in-Depth Security Module
// Prevents command injection attacks through 4 validation layers

interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

// ============================================================================
// LAYER 1: SHELL METACHARACTER DETECTION
// These characters enable command injection and must NEVER appear unquoted
// ============================================================================

// Dangerous shell metacharacters that enable injection attacks
const SHELL_INJECTION_PATTERNS = {
  // Command chaining operators - allow executing multiple commands
  commandChain: /[;&|]/,

  // Command substitution - execute command and substitute output
  commandSubstitution: /`|\$\(/,

  // Process substitution - <() and >() syntax
  processSubstitution: /<\(|\)\(/,

  // Newlines - can break out of single command context
  newlines: /[\r\n]/,

  // Null bytes - can truncate strings in C-based parsers
  nullBytes: /\x00/,

  // Shell variable expansion that could contain malicious commands
  dangerousExpansion: /\$\{[^}]*[`$]|\$\([^)]*\)/,

  // Brace expansion with commands inside
  braceExpansion: /\{[^}]*[;&|`$]/,

  // Here-docs and here-strings - can inject multi-line content
  heredoc: /<<[<-]?/,

  // Output redirection to dangerous locations
  dangerousRedirect: />\s*\/(?:dev\/(?:sd|hd|nvme|null)|etc|bin|usr)/,

  // Input redirection from dangerous sources
  dangerousInput: /<\s*\/(?:dev\/random|dev\/urandom)/,
};

// ============================================================================
// LAYER 2: ALLOWED COMMANDS WHITELIST
// Only these commands are permitted - strict whitelist approach
// ============================================================================

const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  // File system navigation (read-only)
  'ls', 'pwd', 'cd', 'find', 'tree', 'stat', 'file', 'which', 'whereis',

  // File reading (read-only)
  'cat', 'head', 'tail', 'less', 'more', 'wc', 'diff', 'cmp',

  // Text processing
  'grep', 'egrep', 'fgrep', 'rg', 'ag', 'awk', 'sed', 'cut', 'sort', 'uniq',
  'tr', 'column', 'fmt', 'fold', 'nl', 'expand', 'unexpand',

  // Git operations (common and safe)
  'git',

  // Package managers (with restrictions applied separately)
  'npm', 'npx', 'yarn', 'pnpm', 'pip', 'pip3', 'cargo', 'go', 'deno', 'bun',

  // Build tools
  'make', 'cmake', 'tsc', 'esbuild', 'vite', 'webpack', 'rollup', 'turbo',

  // Testing
  'jest', 'vitest', 'mocha', 'pytest',

  // Linting/formatting
  'eslint', 'prettier', 'black', 'rustfmt', 'gofmt',

  // Environment/info
  'echo', 'printf', 'env', 'printenv', 'uname', 'hostname', 'date', 'whoami',
  'id', 'groups', 'uptime', 'df', 'du', 'free', 'top', 'ps',

  // Archives (read operations)
  'tar', 'unzip', 'zip', 'gzip', 'gunzip',

  // Network diagnostics (safe subset)
  'ping', 'host', 'nslookup', 'dig',

  // Docker (with restrictions)
  'docker', 'docker-compose', 'podman',

  // Other dev tools
  'node', 'python', 'python3', 'ruby', 'rustc', 'gcc', 'g++', 'clang',
]);

// ============================================================================
// LAYER 3: DANGEROUS SUBCOMMANDS AND ARGUMENTS
// Even for allowed commands, certain subcommands/args are blocked
// ============================================================================

interface DangerousPattern {
  command: string | RegExp;
  patterns: RegExp[];
  reason: string;
}

const DANGEROUS_SUBCOMMANDS: DangerousPattern[] = [
  {
    command: 'git',
    patterns: [
      /\bpush\s+--force\b/,
      /\bpush\s+-f\b/,
      /\breset\s+--hard\b/,
      /\bclean\s+-fd/,
      /\bcheckout\s+--\s+\./,
    ],
    reason: 'Destructive git operation',
  },
  {
    command: 'npm',
    patterns: [
      /\bexec\b/,
      /\b--shell\b/,
      /\bconfig\s+set\b/,
    ],
    reason: 'npm command can execute arbitrary code',
  },
  {
    command: 'docker',
    patterns: [
      /\b--privileged\b/,
      /\b-v\s+\/:/,
      /\b--pid=host\b/,
      /\b--network=host\b/,
    ],
    reason: 'Docker command grants excessive privileges',
  },
  {
    command: 'tar',
    patterns: [
      /--to-command/,
      /--checkpoint-action/,
      /-I\s/,
    ],
    reason: 'tar option can execute arbitrary commands',
  },
  {
    command: /^(python|python3|node|ruby)$/,
    patterns: [
      /\s-c\s/,
      /\s--eval\b/,
      /\s-e\s/,
    ],
    reason: 'Interpreter with inline code execution',
  },
];

// ============================================================================
// LAYER 4: ABSOLUTELY BLOCKED COMMANDS
// These are NEVER allowed under any circumstances
// ============================================================================

const BLOCKED_COMMANDS: ReadonlySet<string> = new Set([
  // System destruction
  'rm', 'rmdir', 'shred', 'srm',

  // Privilege escalation
  'sudo', 'su', 'doas', 'pkexec',

  // Code execution primitives
  'eval', 'exec', 'source', 'bash', 'sh', 'zsh', 'fish', 'csh', 'tcsh', 'ksh',

  // System modification
  'chmod', 'chown', 'chgrp', 'chattr',

  // Dangerous file operations
  'mv', 'cp', 'ln', 'install',

  // Disk/partition tools
  'dd', 'mkfs', 'fdisk', 'parted', 'format',

  // Network exfiltration - blocks reverse shells and data theft
  'nc', 'netcat', 'ncat', 'socat', 'curl', 'wget', 'scp', 'rsync', 'ftp', 'sftp',

  // Process control
  'kill', 'killall', 'pkill', 'reboot', 'shutdown', 'halt', 'poweroff', 'init',

  // Kernel/modules
  'insmod', 'rmmod', 'modprobe',

  // User management
  'useradd', 'userdel', 'usermod', 'passwd', 'adduser', 'deluser',

  // Cron/scheduling
  'crontab', 'at', 'batch',

  // Other dangerous
  'xargs', 'nohup', 'setsid', 'disown',
]);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract the base command from a command string
 * Handles paths, env vars, and common prefixes
 *
 * Examples:
 *   "ls -la" -> "ls"
 *   "/usr/bin/git status" -> "git"
 *   "VAR=value npm test" -> "npm"
 *   "time nice -n 10 command" -> "command"
 */
function extractBaseCommand(command: string): string | null {
  // Normalize whitespace
  const normalized = command.trim().replace(/\s+/g, ' ');

  if (!normalized) return null;

  // Handle env var prefixes (e.g., "VAR=value command")
  let cmdPart = normalized;
  while (/^[A-Za-z_][A-Za-z0-9_]*=\S*\s/.test(cmdPart)) {
    cmdPart = cmdPart.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, '');
  }

  // Handle wrapper commands like 'time', 'nice', etc.
  const wrapperPrefixes = ['time', 'nice', 'ionice', 'timeout', 'strace', 'ltrace'];
  for (const prefix of wrapperPrefixes) {
    const prefixPattern = new RegExp(`^${prefix}\\s+(-\\S+\\s+)*`);
    if (prefixPattern.test(cmdPart)) {
      cmdPart = cmdPart.replace(prefixPattern, '');
    }
  }

  // Get the first word (the command)
  const firstWord = cmdPart.split(/\s/)[0];
  if (!firstWord) return null;

  // Extract command name from path (e.g., /usr/bin/rm -> rm)
  const basename = firstWord.split('/').pop() || firstWord;

  return basename.toLowerCase();
}

/**
 * Check for quote-based obfuscation attempts
 * Detects attempts to hide command names using quotes/escapes
 *
 * Examples:
 *   r'm' -rf /    (quotes split the command name)
 *   r\"m -rf /    (backslash in command name)
 *   $'\x72\x6d'   (hex-encoded "rm")
 */
function hasQuoteObfuscation(command: string): boolean {
  // Detect commands broken up with quotes: r'm' or "r"m
  const quoteBreakPattern = /[a-z]['"][a-z]|[a-z]["'][a-z]/i;

  // Detect backslash escaping in command names: r\m
  const backslashPattern = /\\[a-z]/i;

  // Detect hex/octal escapes: $'\x72\x6d' (rm in hex)
  const hexOctalPattern = /\$'[^']*\\[xX0-7]/;

  // Detect ANSI-C quoting with dangerous content
  const ansiCPattern = /\$'[^']*'/;

  return (
    quoteBreakPattern.test(command) ||
    backslashPattern.test(command) ||
    hexOctalPattern.test(command) ||
    ansiCPattern.test(command)
  );
}

/**
 * Detect redirection operators and validate them
 * Blocks all I/O redirection as it can be used for injection
 */
function hasUnsafeRedirection(command: string): boolean {
  // Any output redirection (>, >>, 2>, &>)
  const outputRedirect = /[0-9]?>{1,2}|&>/;

  // Any input redirection (<, <<, <<<)
  const inputRedirect = /<{1,3}/;

  // File descriptor manipulation
  const fdManipulation = /[0-9]+>&[0-9]+|[0-9]+<&[0-9]+/;

  return outputRedirect.test(command) || inputRedirect.test(command) || fdManipulation.test(command);
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validates a shell command against security policies using defense-in-depth.
 *
 * Security layers:
 * 1. Shell metacharacter blocking - prevents injection syntax
 * 2. Command whitelist - only known-safe commands allowed
 * 3. Dangerous subcommand blocking - blocks risky options on safe commands
 * 4. Explicit blocklist - never allow inherently dangerous commands
 *
 * @param command - The shell command to validate
 * @returns ValidationResult with valid flag and error message if blocked
 */
export function isCommandAllowed(command: string): ValidationResult {
  const trimmedCommand = command.trim();

  if (!trimmedCommand) {
    return { valid: false, error: 'Empty command' };
  }

  // -------------------------------------------------------------------------
  // LAYER 1: Check for shell injection metacharacters
  // -------------------------------------------------------------------------

  if (SHELL_INJECTION_PATTERNS.nullBytes.test(trimmedCommand)) {
    return { valid: false, error: 'Security: null bytes detected in command' };
  }

  if (SHELL_INJECTION_PATTERNS.commandChain.test(trimmedCommand)) {
    return {
      valid: false,
      error: 'Security: command chaining operators (;, &, |) are not allowed'
    };
  }

  if (SHELL_INJECTION_PATTERNS.commandSubstitution.test(trimmedCommand)) {
    return {
      valid: false,
      error: 'Security: command substitution (` or $()) is not allowed'
    };
  }

  if (SHELL_INJECTION_PATTERNS.newlines.test(trimmedCommand)) {
    return {
      valid: false,
      error: 'Security: newlines in commands are not allowed'
    };
  }

  if (SHELL_INJECTION_PATTERNS.processSubstitution.test(trimmedCommand)) {
    return {
      valid: false,
      error: 'Security: process substitution is not allowed'
    };
  }

  if (SHELL_INJECTION_PATTERNS.heredoc.test(trimmedCommand)) {
    return {
      valid: false,
      error: 'Security: here-documents are not allowed'
    };
  }

  if (hasQuoteObfuscation(trimmedCommand)) {
    return {
      valid: false,
      error: 'Security: quote/escape obfuscation detected'
    };
  }

  if (hasUnsafeRedirection(trimmedCommand)) {
    return {
      valid: false,
      error: 'Security: I/O redirection is not allowed'
    };
  }

  // -------------------------------------------------------------------------
  // LAYER 2 & 4: Extract base command and check against whitelist/blocklist
  // -------------------------------------------------------------------------

  const baseCommand = extractBaseCommand(trimmedCommand);

  if (!baseCommand) {
    return { valid: false, error: 'Unable to parse command' };
  }

  // Layer 4: Check if command is explicitly blocked
  if (BLOCKED_COMMANDS.has(baseCommand)) {
    return {
      valid: false,
      error: `Security: '${baseCommand}' is a blocked command`
    };
  }

  // Layer 2: Check if command is in whitelist
  if (!ALLOWED_COMMANDS.has(baseCommand)) {
    return {
      valid: false,
      error: `Security: '${baseCommand}' is not in the allowed commands list`
    };
  }

  // -------------------------------------------------------------------------
  // LAYER 3: Check for dangerous subcommands/arguments
  // -------------------------------------------------------------------------

  for (const { command: cmdPattern, patterns, reason } of DANGEROUS_SUBCOMMANDS) {
    const matches = typeof cmdPattern === 'string'
      ? baseCommand === cmdPattern
      : cmdPattern.test(baseCommand);

    if (matches) {
      for (const pattern of patterns) {
        if (pattern.test(trimmedCommand)) {
          return {
            valid: false,
            error: `Security: ${reason}`
          };
        }
      }
    }
  }

  return { valid: true };
}

// Export internals for testing
export const _internals = {
  extractBaseCommand,
  hasQuoteObfuscation,
  hasUnsafeRedirection,
  ALLOWED_COMMANDS,
  BLOCKED_COMMANDS,
  DANGEROUS_SUBCOMMANDS,
  SHELL_INJECTION_PATTERNS,
};
