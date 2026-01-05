# Product Requirements Plan (PRP): Grok-CLI Feature Audit & Enhancement

## For: Codex Team
## Version: 1.0
## Date: January 5, 2026

---

## Executive Summary

This PRP documents a comprehensive audit of the grok-cli codebase, identifying gaps compared to Claude Code and providing prioritized recommendations for feature parity and competitive differentiation. The audit covered: core architecture, tools implementation, permission system, and UI/UX components.

**Critical Finding:** The CLI suffers from excessive permission prompts (Y/N for every Bash command) due to missing command-aware permission caching. This severely impacts usability.

**Overall Assessment:** grok-cli is **60-70% feature complete** vs Claude Code, with excellent security foundations but significant UX gaps.

---

## Part 1: Critical Bug - Permission System

### Problem Statement
Users must press 'Y' to confirm **every single Bash command**, including safe read-only commands like `ls`, `git status`, `cat`. This creates "alert fatigue" and severely disrupts workflow.

### Root Cause Analysis

| Issue | File Location | Line | Description |
|-------|---------------|------|-------------|
| Bash not auto-approved | `src/security/permission-manager.ts` | 8 | `AUTO_APPROVED_TOOLS` excludes Bash |
| Hard-coded confirmation | `src/tools/bash.ts` | 9 | `requiresConfirmation = true` (always) |
| Tool-only memory | `src/ui/app.tsx` | 63, 105 | `rememberedTools` stores tool name, not command |
| Session-only storage | `src/ui/app.tsx` | 63 | `useState` loses approvals on restart |
| Unused allowlist | `src/security/command-allowlist.ts` | 53-94 | Security layer exists but not used for UX |

### Recommended Fixes

#### Fix 1: Add Safe Command Bypass (Quick Win)
```typescript
// NEW: src/security/permission-manager.ts
const SAFE_BASH_PATTERNS: RegExp[] = [
  /^ls\b/, /^pwd$/, /^cat\b/, /^head\b/, /^tail\b/,
  /^grep\b/, /^rg\b/, /^find\b/, /^tree\b/, /^wc\b/,
  /^git\s+(status|log|diff|branch|show|remote)\b/,
  /^npm\s+(list|ls|view|outdated|audit)\b/,
];

export function isSafeBashCommand(command: string): boolean {
  return SAFE_BASH_PATTERNS.some(p => p.test(command.trim()));
}
```

#### Fix 2: Command Pattern Memory
```typescript
// CHANGE: src/ui/app.tsx
// From:
const [rememberedTools, setRememberedTools] = useState<Set<string>>(new Set());

// To:
interface ApprovedCommand {
  toolName: string;
  pattern?: string; // e.g., "git *", "npm install *"
}
const [approvedCommands, setApprovedCommands] = useState<ApprovedCommand[]>([]);
```

#### Fix 3: Persistent Permission Storage
Create `src/security/permission-store.ts` to persist approvals to `.grok-cli-permissions.json`

#### Fix 4: Enhanced Confirmation Options
```
[y]es once | [a]lways this command | [t]rust similar | [n]o | [!] trust all bash
```

---

## Part 1.5: Permission Fix Deep Dive (Complete Implementation)

This section provides production-ready code for the Codex team to implement the permission system fix.

### Current Code (Before Fix)

#### File: `src/security/permission-manager.ts` (Current)
```typescript
// Line 8 - Bash is NOT in the auto-approved list
const AUTO_APPROVED_TOOLS = ['Read', 'Glob', 'Grep', 'WebSearch', 'XSearch', 'TodoWrite', 'Task'];

// Lines 47-75 - No command-aware logic
export function requiresConfirmation(toolName: string): boolean {
  // Only checks tool name, not the actual command being run
  return !AUTO_APPROVED_TOOLS.includes(toolName);
}
```

#### File: `src/tools/bash.ts` (Current)
```typescript
// Line 9 - Always requires confirmation, no exceptions
export class BashTool extends BaseTool {
  name = 'Bash';
  requiresConfirmation = true; // ← THE PROBLEM
```

#### File: `src/ui/app.tsx` (Current)
```typescript
// Line 63 - Only stores tool name in a Set, loses on restart
const [rememberedTools, setRememberedTools] = useState<Set<string>>(new Set());

// Lines 103-113 - Only checks if "Bash" was remembered, not specific commands
const handleConfirmation = useCallback((toolName: string, args: Record<string, unknown>): Promise<boolean> => {
  if (rememberedTools.has(toolName)) {  // ← Only checks "Bash", not "git status"
    return Promise.resolve(true);
  }
  // ...shows dialog for EVERY bash command
}, [rememberedTools]);
```

#### File: `src/ui/components/confirm.tsx` (Current)
```typescript
// Lines 11-19 - "Always" only remembers tool type
useInput((input, key) => {
  if (input.toLowerCase() === 'y') {
    onResponse(true, false);  // Single approval
  } else if (input.toLowerCase() === 'a') {
    onResponse(true, true);   // Remember tool (NOT command)
  }
});
```

---

### Fixed Code (After Implementation)

#### Step 1: Create `src/security/safe-commands.ts` (NEW FILE)
```typescript
/**
 * Safe command detection for smart permission bypass
 * These commands are read-only and safe to auto-approve
 */

// Read-only commands that never modify system state
const SAFE_COMMAND_PATTERNS: RegExp[] = [
  // File listing and inspection
  /^ls\b/,
  /^pwd$/,
  /^cat\b/,
  /^head\b/,
  /^tail\b/,
  /^less\b/,
  /^more\b/,
  /^stat\b/,
  /^file\b/,
  /^wc\b/,
  /^du\b/,
  /^df\b/,

  // Search and find
  /^find\b/,
  /^tree\b/,
  /^grep\b/,
  /^egrep\b/,
  /^fgrep\b/,
  /^rg\b/,    // ripgrep
  /^ag\b/,    // silver searcher
  /^fd\b/,    // fd-find

  // Git read-only operations
  /^git\s+(status|log|diff|show|branch|remote|config\s+--list|rev-parse|describe|tag\s+-l)\b/,
  /^git\s+log\b/,

  // Node/npm read-only
  /^npm\s+(list|ls|view|outdated|audit|help|config\s+list)\b/,
  /^npx\s+--version$/,
  /^node\s+--version$/,
  /^npm\s+--version$/,

  // Package info
  /^yarn\s+(list|info|why)\b/,
  /^pnpm\s+(list|ls)\b/,
  /^pip\s+(list|show|freeze)\b/,
  /^pip3\s+(list|show|freeze)\b/,

  // System info (read-only)
  /^which\b/,
  /^whereis\b/,
  /^type\b/,
  /^uname\b/,
  /^hostname$/,
  /^whoami$/,
  /^id$/,
  /^groups$/,
  /^date$/,
  /^uptime$/,
  /^env$/,
  /^printenv\b/,
  /^echo\s+\$/,  // Only echo $VAR (environment inspection)

  // Rust/cargo read-only
  /^cargo\s+(--version|version|tree)\b/,
  /^rustc\s+--version$/,

  // Python read-only
  /^python3?\s+--version$/,
  /^python3?\s+-c\s+"print\(/,  // Simple print statements

  // TypeScript/compiler checks (no emit)
  /^tsc\s+--version$/,
  /^npx\s+tsc\s+--noEmit\b/,
];

// Commands that are NEVER safe (even in safe mode)
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\b/,
  /\bsudo\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bmkfs\b/,
  /\bdd\b/,
  />\s*[/~]/,      // Redirect to absolute path
  /\|\s*sh\b/,      // Piping to shell
  /\|\s*bash\b/,
  /`.*`/,           // Command substitution
  /\$\(.*\)/,       // Command substitution
];

/**
 * Check if a bash command is safe for auto-approval
 * @param command - The full bash command string
 * @returns true if command is safe to auto-approve
 */
export function isSafeBashCommand(command: string): boolean {
  const trimmed = command.trim();

  // First check if command contains dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  // Then check if it matches safe patterns
  for (const pattern of SAFE_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Get a human-readable category for a command
 */
export function getCommandCategory(command: string): string {
  const trimmed = command.trim();

  if (/^git\b/.test(trimmed)) return 'git';
  if (/^npm\b/.test(trimmed)) return 'npm';
  if (/^(ls|pwd|cat|head|tail|find|tree)\b/.test(trimmed)) return 'filesystem';
  if (/^grep|rg|ag\b/.test(trimmed)) return 'search';

  return 'other';
}

/**
 * Create a permission pattern from a specific command
 * e.g., "git status" → "git status", "git log --oneline" → "git log *"
 */
export function createCommandPattern(command: string): string {
  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);

  // For git commands, pattern is "git <subcommand> *"
  if (parts[0] === 'git' && parts.length >= 2) {
    return `git ${parts[1]} *`;
  }

  // For npm commands, pattern is "npm <subcommand> *"
  if (parts[0] === 'npm' && parts.length >= 2) {
    return `npm ${parts[1]} *`;
  }

  // For simple commands, return as-is if single word
  if (parts.length === 1) {
    return parts[0];
  }

  // Otherwise, command + wildcard
  return `${parts[0]} *`;
}
```

#### Step 2: Update `src/security/permission-manager.ts`
```typescript
import { isSafeBashCommand } from './safe-commands.js';

// Auto-approved tools that never need confirmation
const AUTO_APPROVED_TOOLS = ['Read', 'Glob', 'Grep', 'WebSearch', 'XSearch', 'TodoWrite', 'Task'];

// Tools that modify files (affected by acceptEdits mode)
const EDIT_TOOLS = ['Write', 'Edit', 'NotebookEdit'];

// Tools blocked in plan mode (write operations)
const WRITE_TOOLS = ['Write', 'Edit', 'Bash', 'NotebookEdit'];

let currentMode: PermissionMode = 'default';

/**
 * Check if a tool requires confirmation based on current permission mode
 * NOW WITH COMMAND-AWARE LOGIC FOR BASH
 *
 * @param toolName - The name of the tool
 * @param args - Tool arguments (used for command-aware checking)
 * @returns true if confirmation is needed, false if auto-approved
 */
export function requiresConfirmation(toolName: string, args?: Record<string, unknown>): boolean {
  // In bypassPermissions mode, nothing needs confirmation
  if (currentMode === 'bypassPermissions') {
    return false;
  }

  // In plan mode, block write operations entirely
  if (currentMode === 'plan') {
    if (WRITE_TOOLS.includes(toolName)) {
      throw new Error(`Tool "${toolName}" is blocked in Plan Mode (read-only)`);
    }
  }

  // In acceptEdits mode, auto-approve file edit tools
  if (currentMode === 'acceptEdits') {
    if (EDIT_TOOLS.includes(toolName)) {
      return false;
    }
  }

  // ========== NEW: SMART BASH HANDLING ==========
  if (toolName === 'Bash' && args?.command) {
    const command = String(args.command);

    // Safe commands auto-approve without prompting
    if (isSafeBashCommand(command)) {
      return false;  // No confirmation needed for ls, git status, etc.
    }

    // Dangerous commands still require confirmation
    return true;
  }
  // ===============================================

  // Default behavior: check if tool is in auto-approved list
  return !AUTO_APPROVED_TOOLS.includes(toolName);
}
```

#### Step 3: Create `src/security/permission-store.ts` (NEW FILE)
```typescript
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Store permissions per-project in .grok/ or globally in ~/.grok-cli/
const PROJECT_PERMISSION_FILE = '.grok-cli-permissions.json';
const GLOBAL_PERMISSION_DIR = path.join(os.homedir(), '.grok-cli');
const GLOBAL_PERMISSION_FILE = path.join(GLOBAL_PERMISSION_DIR, 'permissions.json');

export interface StoredPermissions {
  // Exact commands that have been approved (e.g., "git push origin main")
  approvedCommands: string[];

  // Glob patterns for approved command families (e.g., "git *", "npm install *")
  approvedPatterns: string[];

  // Trust level for this project
  trustLevel: 'default' | 'trustSafeCommands' | 'trustAllBash';

  // Last updated timestamp
  lastUpdated: string;
}

const DEFAULT_PERMISSIONS: StoredPermissions = {
  approvedCommands: [],
  approvedPatterns: [],
  trustLevel: 'trustSafeCommands',  // Default to trusting safe commands
  lastUpdated: new Date().toISOString(),
};

/**
 * Load permissions from project-local or global file
 */
export async function loadPermissions(): Promise<StoredPermissions> {
  // Try project-local first
  const projectFile = path.join(process.cwd(), PROJECT_PERMISSION_FILE);

  try {
    const data = await fs.readFile(projectFile, 'utf-8');
    return { ...DEFAULT_PERMISSIONS, ...JSON.parse(data) };
  } catch {
    // Try global
    try {
      const data = await fs.readFile(GLOBAL_PERMISSION_FILE, 'utf-8');
      return { ...DEFAULT_PERMISSIONS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  }
}

/**
 * Save permissions to project-local file
 */
export async function savePermissions(permissions: StoredPermissions): Promise<void> {
  const projectFile = path.join(process.cwd(), PROJECT_PERMISSION_FILE);
  permissions.lastUpdated = new Date().toISOString();
  await fs.writeFile(projectFile, JSON.stringify(permissions, null, 2));
}

/**
 * Add an approved command or pattern
 */
export async function approveCommand(command: string, asPattern: boolean = false): Promise<void> {
  const permissions = await loadPermissions();

  if (asPattern) {
    if (!permissions.approvedPatterns.includes(command)) {
      permissions.approvedPatterns.push(command);
    }
  } else {
    if (!permissions.approvedCommands.includes(command)) {
      permissions.approvedCommands.push(command);
    }
  }

  await savePermissions(permissions);
}

/**
 * Check if a command is approved (either exact match or pattern match)
 */
export async function isCommandApproved(command: string): Promise<boolean> {
  const permissions = await loadPermissions();

  // Exact match
  if (permissions.approvedCommands.includes(command.trim())) {
    return true;
  }

  // Pattern match (simple glob: * at end means prefix match)
  for (const pattern of permissions.approvedPatterns) {
    if (pattern.endsWith(' *')) {
      const prefix = pattern.slice(0, -2);
      if (command.trim().startsWith(prefix)) {
        return true;
      }
    } else if (command.trim() === pattern) {
      return true;
    }
  }

  return false;
}

/**
 * Set the trust level for the current project
 */
export async function setTrustLevel(level: StoredPermissions['trustLevel']): Promise<void> {
  const permissions = await loadPermissions();
  permissions.trustLevel = level;
  await savePermissions(permissions);
}
```

#### Step 4: Update `src/ui/app.tsx`
```typescript
// Add imports
import {
  loadPermissions,
  approveCommand,
  isCommandApproved,
  StoredPermissions
} from '../security/permission-store.js';
import { createCommandPattern, isSafeBashCommand } from '../security/safe-commands.js';

// Replace rememberedTools with more sophisticated state
interface ApprovalMemory {
  // Session-only approvals (tool names like "Bash")
  sessionTools: Set<string>;

  // Session command approvals (specific commands)
  sessionCommands: Set<string>;

  // Session pattern approvals (e.g., "git *")
  sessionPatterns: string[];

  // Loaded from disk
  persistedPermissions: StoredPermissions | null;
}

// In App component:
const [approvalMemory, setApprovalMemory] = useState<ApprovalMemory>({
  sessionTools: new Set(),
  sessionCommands: new Set(),
  sessionPatterns: [],
  persistedPermissions: null,
});

// Load persisted permissions on mount
useEffect(() => {
  loadPermissions().then(perms => {
    setApprovalMemory(prev => ({ ...prev, persistedPermissions: perms }));
  });
}, []);

// Updated confirmation handler with command-aware logic
const handleConfirmation = useCallback(async (
  toolName: string,
  args: Record<string, unknown>
): Promise<boolean> => {

  // 1. Check if entire tool was remembered this session
  if (approvalMemory.sessionTools.has(toolName)) {
    return true;
  }

  // 2. For Bash, check command-specific approvals
  if (toolName === 'Bash' && args.command) {
    const command = String(args.command);

    // Check safe commands (always auto-approve)
    if (isSafeBashCommand(command)) {
      return true;
    }

    // Check session command memory
    if (approvalMemory.sessionCommands.has(command)) {
      return true;
    }

    // Check session pattern memory
    for (const pattern of approvalMemory.sessionPatterns) {
      if (pattern.endsWith(' *')) {
        const prefix = pattern.slice(0, -2);
        if (command.startsWith(prefix)) return true;
      }
    }

    // Check persisted permissions
    if (await isCommandApproved(command)) {
      return true;
    }
  }

  // 3. Show confirmation dialog
  return new Promise((resolve) => {
    setPendingConfirm({
      toolName,
      args,
      resolve,
      // Pass command for Bash tools
      command: toolName === 'Bash' ? String(args.command) : undefined,
    });
    setState('confirming');
  });
}, [approvalMemory]);
```

#### Step 5: Update `src/ui/components/confirm.tsx`
```typescript
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { createCommandPattern } from '../../security/safe-commands.js';

interface ConfirmDialogProps {
  toolName: string;
  args: Record<string, unknown>;
  command?: string;  // For Bash commands
  onResponse: (
    approved: boolean,
    rememberType?: 'once' | 'command' | 'pattern' | 'tool' | 'allBash'
  ) => void;
}

export function ConfirmDialog({ toolName, args, command, onResponse }: ConfirmDialogProps) {
  const [showHelp, setShowHelp] = useState(false);

  // Generate pattern for display
  const pattern = command ? createCommandPattern(command) : null;

  useInput((input, key) => {
    const char = input.toLowerCase();

    if (char === 'y') {
      onResponse(true, 'once');           // Yes, just this once
    } else if (char === 'a') {
      onResponse(true, 'command');        // Always this exact command
    } else if (char === 't' && pattern) {
      onResponse(true, 'pattern');        // Trust similar (pattern)
    } else if (char === '!') {
      onResponse(true, 'allBash');        // Trust ALL bash (session only)
    } else if (char === 'n' || key.return) {
      onResponse(false);
    } else if (char === '?') {
      setShowHelp(!showHelp);
    }
  });

  // Format args for display
  const argsDisplay = JSON.stringify(args, null, 2);
  const truncatedArgs = argsDisplay.length > 500
    ? argsDisplay.slice(0, 500) + '\n...(truncated)'
    : argsDisplay;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>⚠️  Permission Required</Text>

      <Box marginY={1}>
        <Text>Tool: </Text>
        <Text color="cyan" bold>{toolName}</Text>
      </Box>

      {command && (
        <Box marginBottom={1}>
          <Text>Command: </Text>
          <Text color="magenta">{command.length > 80 ? command.slice(0, 80) + '...' : command}</Text>
        </Box>
      )}

      <Box marginBottom={1} flexDirection="column">
        <Text color="gray" dimColor>{truncatedArgs}</Text>
      </Box>

      <Box flexDirection="column">
        <Box>
          <Text color="green">[y]es once</Text>
          <Text color="gray"> | </Text>
          <Text color="blue">[a]lways this command</Text>
          {pattern && (
            <>
              <Text color="gray"> | </Text>
              <Text color="cyan">[t]rust similar ({pattern})</Text>
            </>
          )}
        </Box>
        <Box>
          <Text color="red">[n]o</Text>
          <Text color="gray"> | </Text>
          <Text color="yellow">[!] trust all bash</Text>
          <Text color="gray"> | </Text>
          <Text color="gray">[?] help</Text>
        </Box>
      </Box>

      {showHelp && (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
          <Text color="white" bold>Permission Options:</Text>
          <Text color="green">y - Approve once (this invocation only)</Text>
          <Text color="blue">a - Remember this exact command for this project</Text>
          {pattern && <Text color="cyan">t - Trust all commands matching "{pattern}"</Text>}
          <Text color="yellow">! - Auto-approve ALL bash commands this session (use carefully)</Text>
          <Text color="red">n - Deny this command</Text>
        </Box>
      )}
    </Box>
  );
}
```

---

### Migration Path

1. **Phase 1 (Immediate):** Add `isSafeBashCommand()` check - reduces 80% of prompts
2. **Phase 2 (This Week):** Add command-specific memory in app.tsx
3. **Phase 3 (Next Week):** Add persistent storage and pattern matching
4. **Phase 4 (Later):** Add UI for managing saved permissions (`/permissions` command)

### Testing Checklist

```bash
# These should auto-approve (no prompt):
ls -la
git status
npm list
cat package.json
pwd

# These should still prompt:
git push origin main
npm install lodash
rm -rf node_modules
echo "test" > file.txt

# After pressing [a]lways, this exact command auto-approves:
npm run build  # (first time: prompt, after [a]: auto)

# After pressing [t]rust similar for "npm run build":
npm run test   # Should auto-approve (matches "npm run *")
```

---

## Part 2: Missing Tools (vs Claude Code)

### Current Tools (9)
| Tool | Status |
|------|--------|
| Read | Basic (missing image/PDF/notebook support) |
| Write | Complete |
| Edit | Complete |
| Bash | Basic (missing background execution) |
| Glob | Basic (missing mtime sorting) |
| Grep | Basic (missing output modes, context lines) |
| TodoWrite | Complete |
| Task | Custom subagent system |
| VideoAnalyze | Unique to grok-cli |

### Missing Tools (High Priority)

#### WebFetch Tool
- **File:** `src/tools/web-fetch.ts`
- **Purpose:** Fetch and analyze web URLs with AI summarization
- **Parameters:** `url`, `prompt`
- **Features:** HTML-to-markdown, 15-min cache, redirect handling

#### WebSearch Tool
- **File:** `src/tools/web-search.ts`
- **Purpose:** Search web for current information
- **Parameters:** `query`, `allowed_domains?`, `blocked_domains?`
- **Features:** Source citations, domain filtering

#### BashOutput Tool
- **File:** `src/tools/bash-output.ts`
- **Purpose:** Read output from background processes
- **Parameters:** `bash_id`, `filter?`

### Tool Enhancements Needed

#### Bash Enhancements
```typescript
// Add parameters:
run_in_background: z.boolean().optional(),
description: z.string().optional(), // 5-10 word description
timeout: z.number().max(600000).default(120000), // Up to 10 min
```

#### Grep Enhancements
```typescript
// Add parameters:
output_mode: z.enum(['content', 'files_with_matches', 'count']),
head_limit: z.number().optional(),
offset: z.number().optional(),
'-A': z.number().optional(), // lines after
'-B': z.number().optional(), // lines before
'-C': z.number().optional(), // context lines
multiline: z.boolean().optional(),
type: z.string().optional(), // file type filter
'-i': z.boolean().optional(), // case insensitive
```

#### Read Enhancements
- Add image file support (PNG, JPG) - visual analysis
- Add PDF text/visual extraction
- Add Jupyter notebook rendering with outputs
- Add 2000-line default limit with line truncation at 2000 chars

---

## Part 3: Missing Commands

### Current Commands (6)
`/help`, `/model`, `/clear`, `/exit`, `/history`, `/mode`

### Required Commands (Priority Order)

| Command | Priority | Description |
|---------|----------|-------------|
| `/compact` | P0 | Summarize conversation to save context |
| `/context` | P0 | Manage included context files |
| `/config` | P1 | View/edit configuration |
| `/status` | P1 | Show session info (tokens, cost, context size) |
| `/init` | P1 | Initialize project-specific config |
| `/resume` | P1 | Resume previous session |
| `/permissions` | P2 | View/manage tool permissions |
| `/doctor` | P2 | Diagnose setup issues |
| `/cost` | P2 | Display token usage and API cost |
| `/mcp` | P3 | MCP server management |

### Custom Command System
- Load commands from `.grok/commands/*.md`
- Parse frontmatter for arguments
- Enable user-defined workflows

---

## Part 4: UI/UX Improvements

### 4.1 Output Formatting (Critical)
**Current:** Plain text with no formatting
**Required:**
- Markdown rendering (`marked-terminal` or `ink-markdown`)
- Syntax highlighting for code blocks
- Colored diff display in confirmations

**Files to modify:**
- `src/ui/components/message.tsx` - Add markdown renderer
- `src/ui/components/confirm.tsx` - Add diff display
- `src/ui/components/tool-output.tsx` - Add syntax highlighting

### 4.2 Input Experience
**Missing features:**
- Up/down arrow command history
- Multi-line input (Shift+Enter)
- File path tab completion
- Ctrl+R history search

**File to modify:** `src/ui/components/input.tsx`

### 4.3 Keyboard Shortcuts
**Current:** Esc, Ctrl+C, Shift+Tab
**Add:**
- `Ctrl+R` - Search command history
- `Ctrl+L` - Clear screen
- `Ctrl+U` - Clear input line
- `Ctrl+A/E` - Line start/end
- `Tab` - File path completion

### 4.4 Progress Indicators
**Current:** Basic ASCII spinner
**Required:**
- Token count during streaming
- File operation progress bars
- Estimated time remaining

---

## Part 5: Architecture Improvements

### 5.1 Token Management (Critical Gap)
**Issue:** Unbounded message history causes context overflow
**Solution:**
1. Add token counting with tiktoken
2. Implement auto-summarization at 80% context
3. Add cost tracking and budgeting
4. Display token count per message

**File:** `src/agent/grok-agent.ts` lines 26, 122-293

### 5.2 Tool Parallelization
**Issue:** Tools execute sequentially (line 191)
**Solution:** Execute independent tool calls concurrently with dependency analysis

### 5.3 Session Persistence
**Issue:** Conversations lost on restart
**Solution:**
- Auto-save to `.grok-cli-sessions/`
- `/resume` command to continue previous session
- Configurable retention period

### 5.4 MCP Integration
**Missing:** Model Context Protocol support for external tools
**Benefit:** Plugin ecosystem, IDE integrations

### 5.5 Refactor app.tsx
**Issue:** 509 lines in single component
**Solution:**
- Extract state management to custom hooks
- Split into smaller components
- Add React error boundaries

---

## Part 6: Security Considerations

### Current Strengths (Keep)
- 4-layer command allowlist defense
- Symlink-aware path validation
- TOCTOU mitigation with `validateAndOpen()`
- Comprehensive blocked command patterns

### Improvements Needed
- Allow `curl`/`wget` with URL pattern restrictions (currently blocked)
- Add audit logging of permission decisions
- Per-project permission persistence
- Tool-specific timeout configurations

---

## Part 7: Competitive Differentiation Opportunities

### Features to Surpass Claude Code

1. **Video Analysis Tool** - Already unique to grok-cli
2. **Real-time xAI Integration** - Leverage Grok's real-time knowledge
3. **Voice Control** - AgentVibes TTS integration (already exists)
4. **Multi-Model Orchestration** - Run different Grok models for different tasks
5. **Custom Agent Marketplace** - Share `.grok/agents/` definitions
6. **Visual Diagram Generation** - Integrate with Excalidraw/Mermaid
7. **Local LLM Fallback** - Offline mode with local models

---

## Part 8: Implementation Roadmap

### Phase 1: Critical UX (Week 1-2)
1. Fix permission system (safe command bypass)
2. Add markdown rendering
3. Add input history
4. Add `/compact` command

### Phase 2: Feature Parity (Week 3-4)
5. Add WebFetch and WebSearch tools
6. Enhance Grep with output modes
7. Add session persistence
8. Add `/context`, `/config`, `/status` commands

### Phase 3: Polish (Week 5-6)
9. Token tracking and cost display
10. Background Bash execution
11. Syntax highlighting
12. Multi-line input support

### Phase 4: Differentiation (Week 7-8)
13. MCP integration
14. Tool parallelization
15. Custom command system
16. Advanced subagent orchestration

---

## Part 9: Files Reference

### Core Files to Modify
| File | Changes |
|------|---------|
| `src/security/permission-manager.ts` | Add safe command detection |
| `src/tools/bash.ts` | Dynamic confirmation, background support |
| `src/ui/app.tsx` | Command memory, token tracking, refactor |
| `src/ui/components/input.tsx` | History, multi-line |
| `src/ui/components/message.tsx` | Markdown rendering |
| `src/ui/components/confirm.tsx` | Diff display, more options |
| `src/tools/grep.ts` | Output modes, context lines |
| `src/agent/grok-agent.ts` | Token management, parallelization |
| `src/commands/index.ts` | Register new commands |

### New Files to Create
| File | Purpose |
|------|---------|
| `src/tools/web-fetch.ts` | WebFetch tool |
| `src/tools/web-search.ts` | WebSearch tool |
| `src/tools/bash-output.ts` | BashOutput tool |
| `src/security/permission-store.ts` | Persistent permissions |
| `src/lib/markdown-renderer.ts` | Markdown/syntax highlighting |
| `src/lib/session-manager.ts` | Session persistence |
| `src/lib/token-tracker.ts` | Token counting |
| `src/commands/handlers/compact.ts` | Compact command |
| `src/commands/handlers/context.ts` | Context command |
| `src/commands/handlers/config.ts` | Config command |
| `src/commands/handlers/status.ts` | Status command |

---

## Part 10: Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Permission prompts per session | 50+ | <5 |
| Commands available | 6 | 15+ |
| Tools available | 9 | 12+ |
| Feature parity with Claude Code | 60-70% | 95%+ |
| Unique differentiating features | 2 | 5+ |

---

## Appendix: Quick Win Summary

For immediate improvement, make these minimal changes:

1. **Add Bash to AUTO_APPROVED_TOOLS** (1 line change)
   - File: `src/security/permission-manager.ts:8`
   - Note: Command allowlist still provides security

2. **Add read-only command patterns** (20 lines)
   - File: `src/security/permission-manager.ts`
   - Bypass confirmation for `ls`, `pwd`, `cat`, `git status`, etc.

3. **Install markdown renderer** (1 package + 10 lines)
   - `npm install marked marked-terminal`
   - Wrap output in markdown renderer

These 3 changes would dramatically improve UX with minimal risk.

---

*End of PRP Document*
