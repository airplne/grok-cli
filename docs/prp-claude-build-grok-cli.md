# PRP: Build grok-cli - Standalone Claude Code Clone for xAI Grok

**Created**: 2026-01-03
**Author**: Claude Opus 4.5 (ULTRATHINK session)
**Status**: Ready for Execution
**Estimated Effort**: 22-32 hours (3 phases)

---

## Executive Summary

Build a standalone CLI tool called `grok-cli` that replicates Claude Code's functionality using the xAI Grok API. The tool will be fully standalone (no automaker dependencies), feature-complete with Claude Code parity, and integrate with AgentVibes TTS.

---

## Background Research

### xAI API Compatibility

The xAI Grok API is **100% OpenAI-compatible**:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,  // or GROK_API_KEY
  baseURL: 'https://api.x.ai/v1',
});
```

| Feature | Value |
|---------|-------|
| Base URL | `https://api.x.ai/v1` |
| API Key Format | Starts with `xai-` |
| Best Model | `grok-4-1-fast` |
| Context Window | **2M tokens** |
| Pricing | $0.20 input / $0.50 output per 1M tokens |
| Function Calling | Up to 200 tools |
| Built-in Tools | web_search, x_search, code_execution |
| Streaming | SSE (Server-Sent Events) |

### Prior Security Research

The superagent-ai/grok-cli repository was audited:
- **Organization**: YC W24, $2.1M funding, legitimate founders
- **Code Safety**: No backdoors or malware detected
- **Vulnerabilities**: Command injection, path traversal (we'll fix these)

---

## Requirements

### Core Requirements (User-Specified)

| Requirement | Decision |
|-------------|----------|
| Integration | **Fully Standalone** - zero automaker dependencies |
| Scope | **Claude Code Parity** - full feature set |
| Permissions | **Auto-approve reads** - confirm writes/bash only |
| TTS | **Yes** - AgentVibes integration |
| Subagents | **Same model** - Grok spawns Grok |
| Sessions | **Both** - .grok/ (project) + ~/.grok/ (global) |
| Hooks | **Full** - all 10 Claude Code events |
| Web Tools | **xAI built-in** - web_search, x_search |
| Terminal UI | **Ink** - React for CLI |
| Context | **Full hierarchy** - GROK.md + @import support |
| MCP | **Yes** - MCP server support |
| API Key | **Both** - GROK_API_KEY fallback to XAI_API_KEY |

### Implementation Strategy

**Build iteratively in 3 phases** - each phase produces a working CLI:

1. **Phase 1**: Core agent + 6 tools (working CLI)
2. **Phase 2**: Sessions + hooks + TTS
3. **Phase 3**: Subagents + MCP + web tools

---

## Project Structure

Create the following structure at `/tools/grok-cli/`:

```
tools/grok-cli/
├── package.json
├── tsconfig.json
├── README.md
├── GROK.md                      # Example context file
├── src/
│   ├── index.ts                 # CLI entry (commander)
│   ├── cli.tsx                  # Ink React app
│   ├── agent/
│   │   ├── grok-agent.ts        # Core agent loop
│   │   ├── tool-executor.ts     # Tool dispatch
│   │   └── subagent.ts          # Subagent spawning (Phase 3)
│   ├── client/
│   │   ├── grok-client.ts       # OpenAI SDK wrapper
│   │   └── streaming.ts         # Stream handling
│   ├── tools/
│   │   ├── index.ts             # Tool registry
│   │   ├── base-tool.ts         # Abstract tool class
│   │   ├── read.ts              # File reading
│   │   ├── write.ts             # File writing
│   │   ├── edit.ts              # String replacement
│   │   ├── bash.ts              # Shell execution
│   │   ├── glob.ts              # File patterns
│   │   ├── grep.ts              # Content search
│   │   ├── web-search.ts        # xAI web_search (Phase 3)
│   │   ├── x-search.ts          # xAI x_search (Phase 3)
│   │   └── todo.ts              # Todo tracking
│   ├── mcp/                     # MCP support (Phase 3)
│   │   ├── mcp-manager.ts
│   │   └── mcp-tool.ts
│   ├── hooks/                   # Hook system (Phase 2)
│   │   ├── hook-manager.ts
│   │   └── hook-types.ts
│   ├── session/                 # Session persistence (Phase 2)
│   │   ├── session-manager.ts
│   │   └── session-storage.ts
│   ├── context/                 # GROK.md loading
│   │   ├── context-loader.ts
│   │   └── import-resolver.ts
│   ├── security/
│   │   ├── path-validator.ts
│   │   ├── command-allowlist.ts
│   │   └── permission-manager.ts
│   ├── ui/
│   │   ├── app.tsx              # Main Ink app
│   │   ├── components/
│   │   │   ├── message.tsx      # Message display
│   │   │   ├── tool-output.tsx  # Tool results
│   │   │   ├── spinner.tsx      # Loading indicator
│   │   │   ├── confirm.tsx      # Confirmation dialog
│   │   │   └── markdown.tsx     # Markdown renderer
│   │   └── hooks/
│   │       └── use-streaming.ts
│   ├── config/
│   │   ├── settings.ts          # .grok/settings.json
│   │   └── models.ts            # Model definitions
│   └── lib/
│       ├── logger.ts
│       ├── errors.ts
│       └── tts.ts               # AgentVibes TTS integration
└── tests/
    ├── unit/
    └── e2e/
```

---

## Phase 1: Core Agent MVP

**Goal**: Working CLI with 6 core tools
**Effort**: 8-12 hours

### Step 1.1: Project Setup

```bash
# Create directory
mkdir -p tools/grok-cli
cd tools/grok-cli

# Initialize npm
npm init -y

# Install dependencies
npm install openai commander ink react chalk ora fast-glob zod
npm install -D typescript @types/node @types/react tsx vitest
```

Create `package.json`:
```json
{
  "name": "grok-cli",
  "version": "1.0.0",
  "description": "Claude Code clone for xAI Grok",
  "type": "module",
  "bin": {
    "grok": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.tsx",
    "build": "tsc",
    "test": "vitest",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "openai": "^4.58.0",
    "ink": "^5.0.0",
    "react": "^18.3.0",
    "chalk": "^5.3.0",
    "fast-glob": "^3.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "tsx": "^4.19.0",
    "vitest": "^2.0.0"
  }
}
```

**Note**: We use `ink` v5 which includes React. The `tsx` loader handles JSX/TSX compilation at runtime for development.

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 1.2: Create Grok Client

Create `src/client/grok-client.ts`:
```typescript
import OpenAI from 'openai';

export interface GrokClientConfig {
  apiKey?: string;
  model?: string;
  timeout?: number;
}

export class GrokClient {
  private client: OpenAI;
  public model: string;

  constructor(config: GrokClientConfig = {}) {
    const apiKey = config.apiKey
      || process.env.GROK_API_KEY
      || process.env.XAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Missing API key. Set GROK_API_KEY or XAI_API_KEY environment variable.'
      );
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
      timeout: config.timeout || 120000,
    });

    this.model = config.model || 'grok-4-1-fast';
  }

  get openai(): OpenAI {
    return this.client;
  }
}
```

### Step 1.3: Create Tool Base Class

Create `src/tools/base-tool.ts`:
```typescript
import { z } from 'zod';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodObject<any>;

  // Override to require confirmation
  requiresConfirmation = false;

  abstract execute(args: Record<string, unknown>): Promise<ToolResult>;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.zodToJsonSchema(this.parameters),
      },
    };
  }

  private zodToJsonSchema(schema: z.ZodObject<any>): Record<string, unknown> {
    // Convert Zod schema to JSON Schema for OpenAI
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodTypeAny;
      properties[key] = this.zodTypeToJsonSchema(zodType);

      if (!zodType.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  private zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
    if (zodType instanceof z.ZodString) {
      return { type: 'string', description: zodType.description };
    }
    if (zodType instanceof z.ZodNumber) {
      return { type: 'number', description: zodType.description };
    }
    if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean', description: zodType.description };
    }
    if (zodType instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJsonSchema(zodType.element),
        description: zodType.description,
      };
    }
    if (zodType instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(zodType.unwrap());
    }
    return { type: 'string' };
  }
}
```

### Step 1.4: Implement Core Tools

Create `src/tools/read.ts`:
```typescript
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class ReadTool extends BaseTool {
  name = 'Read';
  description = 'Read the contents of a file. Returns the file content with line numbers.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    file_path: z.string().describe('The absolute path to the file to read'),
    offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
    limit: z.number().optional().describe('Maximum number of lines to read'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, offset = 1, limit } = this.parameters.parse(args);

    try {
      const validated = validatePath(file_path);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      const content = await fs.readFile(file_path, 'utf-8');
      const lines = content.split('\n');

      const startLine = Math.max(1, offset) - 1;
      const endLine = limit ? startLine + limit : lines.length;
      const selectedLines = lines.slice(startLine, endLine);

      // Format with line numbers
      const formatted = selectedLines
        .map((line, i) => `${String(startLine + i + 1).padStart(6)}→${line}`)
        .join('\n');

      return { success: true, output: formatted };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      };
    }
  }
}
```

Create `src/tools/write.ts`:
```typescript
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class WriteTool extends BaseTool {
  name = 'Write';
  description = 'Write content to a file. Creates the file if it does not exist.';
  requiresConfirmation = true; // Requires user confirmation

  parameters = z.object({
    file_path: z.string().describe('The absolute path to the file to write'),
    content: z.string().describe('The content to write to the file'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, content } = this.parameters.parse(args);

    try {
      const validated = validatePath(file_path);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(file_path), { recursive: true });

      await fs.writeFile(file_path, content, 'utf-8');

      return {
        success: true,
        output: `Successfully wrote ${content.length} bytes to ${file_path}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file',
      };
    }
  }
}
```

Create `src/tools/edit.ts`:
```typescript
import { z } from 'zod';
import { promises as fs } from 'fs';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class EditTool extends BaseTool {
  name = 'Edit';
  description = 'Replace a specific string in a file with new content.';
  requiresConfirmation = true; // Requires user confirmation

  parameters = z.object({
    file_path: z.string().describe('The absolute path to the file to edit'),
    old_string: z.string().describe('The exact string to find and replace'),
    new_string: z.string().describe('The string to replace it with'),
    replace_all: z.boolean().optional().describe('Replace all occurrences (default: false)'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, old_string, new_string, replace_all = false } = this.parameters.parse(args);

    try {
      const validated = validatePath(file_path);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      const content = await fs.readFile(file_path, 'utf-8');

      if (!content.includes(old_string)) {
        return {
          success: false,
          error: `String "${old_string.slice(0, 50)}..." not found in file`,
        };
      }

      // Count occurrences
      const occurrences = content.split(old_string).length - 1;

      if (occurrences > 1 && !replace_all) {
        return {
          success: false,
          error: `Found ${occurrences} occurrences. Use replace_all=true to replace all, or provide more context to make the string unique.`,
        };
      }

      const newContent = replace_all
        ? content.replaceAll(old_string, new_string)
        : content.replace(old_string, new_string);

      await fs.writeFile(file_path, newContent, 'utf-8');

      return {
        success: true,
        output: `Replaced ${replace_all ? occurrences : 1} occurrence(s) in ${file_path}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit file',
      };
    }
  }
}
```

Create `src/tools/bash.ts`:
```typescript
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, ToolResult } from './base-tool.js';
import { isCommandAllowed } from '../security/command-allowlist.js';

const execAsync = promisify(exec);

export class BashTool extends BaseTool {
  name = 'Bash';
  description = 'Execute a shell command. Use for git, npm, and other CLI operations.';
  requiresConfirmation = true; // Requires user confirmation

  parameters = z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { command, timeout = 30000 } = this.parameters.parse(args);

    try {
      // Security: Check command allowlist
      const allowed = isCommandAllowed(command);
      if (!allowed.valid) {
        return { success: false, error: allowed.error };
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
        cwd: process.cwd(),
      });

      let output = stdout;
      if (stderr) {
        output += `\n[STDERR]\n${stderr}`;
      }

      return { success: true, output };
    } catch (error: any) {
      const errorMessage = error.stderr || error.message || 'Command failed';
      return {
        success: false,
        error: errorMessage,
        output: error.stdout,
      };
    }
  }
}
```

Create `src/tools/glob.ts`:
```typescript
import { z } from 'zod';
import fg from 'fast-glob';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class GlobTool extends BaseTool {
  name = 'Glob';
  description = 'Find files matching a glob pattern. Returns list of matching file paths.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    pattern: z.string().describe('The glob pattern to match (e.g., "**/*.ts")'),
    path: z.string().optional().describe('Directory to search in (default: current directory)'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, path: searchPath = process.cwd() } = this.parameters.parse(args);

    try {
      const validated = validatePath(searchPath);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      const files = await fg(pattern, {
        cwd: searchPath,
        ignore: ['**/node_modules/**', '**/.git/**'],
        onlyFiles: true,
        absolute: true,
      });

      if (files.length === 0) {
        return { success: true, output: 'No files found matching pattern.' };
      }

      return {
        success: true,
        output: files.join('\n'),
        data: { count: files.length },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Glob search failed',
      };
    }
  }
}
```

Create `src/tools/grep.ts`:
```typescript
import { z } from 'zod';
import { spawn } from 'child_process';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class GrepTool extends BaseTool {
  name = 'Grep';
  description = 'Search for a pattern in files using ripgrep. Returns matching lines.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    pattern: z.string().describe('The regex pattern to search for'),
    path: z.string().optional().describe('File or directory to search in'),
    glob: z.string().optional().describe('File pattern to filter (e.g., "*.ts")'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, path: searchPath = '.', glob } = this.parameters.parse(args);

    try {
      const validated = validatePath(searchPath);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      const rgArgs = [
        '--line-number',
        '--color=never',
        '--no-heading',
      ];

      if (glob) {
        rgArgs.push('--glob', glob);
      }

      rgArgs.push(pattern, searchPath);

      return new Promise((resolve) => {
        const rg = spawn('rg', rgArgs, { cwd: process.cwd() });
        let stdout = '';
        let stderr = '';

        rg.stdout.on('data', (data) => { stdout += data; });
        rg.stderr.on('data', (data) => { stderr += data; });

        rg.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, output: stdout || 'No matches found.' });
          } else if (code === 1) {
            resolve({ success: true, output: 'No matches found.' });
          } else {
            resolve({ success: false, error: stderr || 'Search failed' });
          }
        });

        rg.on('error', (err) => {
          // ripgrep not installed, fall back to grep
          resolve({ success: false, error: 'ripgrep (rg) not found. Install with: brew install ripgrep' });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }
}
```

Create `src/tools/todo.ts`:
```typescript
import { z } from 'zod';
import { BaseTool, ToolResult } from './base-tool.js';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// In-memory store (shared across tool invocations)
let currentTodos: TodoItem[] = [];

export class TodoTool extends BaseTool {
  name = 'TodoWrite';
  description = 'Create and manage a structured task list. Use to track progress on multi-step tasks.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    todos: z.array(z.object({
      content: z.string().describe('Task description in imperative form'),
      status: z.enum(['pending', 'in_progress', 'completed']).describe('Task status'),
      activeForm: z.string().describe('Present continuous form shown during execution'),
    })).describe('The updated todo list'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { todos } = this.parameters.parse(args);

    currentTodos = todos;

    const summary = todos.map(t => {
      const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
      return `${icon} ${t.content}`;
    }).join('\n');

    return {
      success: true,
      output: `Todo list updated:\n${summary}`,
      data: { todos },
    };
  }

  static getTodos(): TodoItem[] {
    return currentTodos;
  }
}
```

Create `src/tools/index.ts`:
```typescript
import { BaseTool } from './base-tool.js';
import { ReadTool } from './read.js';
import { WriteTool } from './write.js';
import { EditTool } from './edit.js';
import { BashTool } from './bash.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import { TodoTool } from './todo.js';

export const tools: BaseTool[] = [
  new ReadTool(),
  new WriteTool(),
  new EditTool(),
  new BashTool(),
  new GlobTool(),
  new GrepTool(),
  new TodoTool(),
];

export function getToolDefinitions() {
  return tools.map(tool => tool.getDefinition());
}

export function getTool(name: string): BaseTool | undefined {
  return tools.find(tool => tool.name === name);
}

export { BaseTool, ToolResult, ToolDefinition } from './base-tool.js';
export { TodoTool, TodoItem } from './todo.js';
```

### Step 1.5: Create Security Layer

Create `src/security/path-validator.ts`:
```typescript
import path from 'path';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Blocked patterns - never allow access to these
const BLOCKED_PATTERNS = [
  /\.ssh/,
  /\.aws/,
  /\.gnupg/,
  /credentials/i,
  /secrets/i,
  /\.env(?:\.|$)/,
  /private.*key/i,
];

export function validatePath(filePath: string): ValidationResult {
  try {
    const resolved = path.resolve(filePath);
    const cwd = process.cwd();

    // Check if path is within current working directory
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      // Allow if it's within home directory but warn
      const home = process.env.HOME || '';
      if (!resolved.startsWith(home)) {
        return {
          valid: false,
          error: `Path traversal blocked: ${filePath} is outside allowed directories`,
        };
      }
    }

    // Check blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(resolved)) {
        return {
          valid: false,
          error: `Access denied: ${filePath} matches blocked pattern`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Path validation failed',
    };
  }
}
```

Create `src/security/command-allowlist.ts`:
```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Dangerous commands that should never be allowed
const BLOCKED_COMMANDS = [
  /\brm\s+-rf\s+[\/~]/,  // rm -rf / or ~
  /\b(curl|wget).*\|\s*(bash|sh)/,  // Pipe to shell
  /\beval\b/,
  /\bsudo\b/,
  /\bchmod\s+777/,
  /\bdd\s+if=/,
  />\s*\/dev\/(sd|hd|nvme)/,  // Write to block devices
  /\bmkfs\b/,
  /\bformat\b.*[cC]:/,
];

// Commands that require extra caution
const SENSITIVE_COMMANDS = [
  /\brm\b/,
  /\bmv\b.*\//,
  /\bchmod\b/,
  /\bchown\b/,
];

export function isCommandAllowed(command: string): ValidationResult {
  // Check for explicitly blocked dangerous commands
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return {
        valid: false,
        error: `Dangerous command blocked: This command pattern is not allowed for safety`,
      };
    }
  }

  // Check for null bytes (injection attempt)
  if (command.includes('\x00')) {
    return { valid: false, error: 'Invalid command: null bytes detected' };
  }

  // Check for command chaining that might bypass safety
  const chainPatterns = /;\s*(rm|sudo|eval|dd|mkfs)/;
  if (chainPatterns.test(command)) {
    return {
      valid: false,
      error: 'Dangerous command chain detected',
    };
  }

  return { valid: true };
}
```

Create `src/security/permission-manager.ts`:
```typescript
const AUTO_APPROVED_TOOLS = ['Read', 'Glob', 'Grep', 'WebSearch', 'XSearch', 'TodoWrite'];

export function requiresConfirmation(toolName: string): boolean {
  return !AUTO_APPROVED_TOOLS.includes(toolName);
}

// ConfirmationHandler type for Ink UI integration
export type ConfirmationHandler = (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
```

### Step 1.6: Create Utility Files

Create `src/lib/errors.ts`:
```typescript
export class GrokError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'GrokError';
  }
}

export class APIError extends GrokError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'API_ERROR');
    this.name = 'APIError';
  }
}

export class ToolError extends GrokError {
  constructor(message: string, public readonly toolName?: string) {
    super(message, 'TOOL_ERROR');
    this.name = 'ToolError';
  }
}

export class SecurityError extends GrokError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
  }
}

export class ConfigError extends GrokError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

export function formatError(error: unknown): string {
  if (error instanceof GrokError) {
    return `[${error.code || error.name}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

Create `src/lib/logger.ts`:
```typescript
import { promises as fs } from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = 'info';
  private logDir: string;

  constructor() {
    this.level = (process.env.GROK_LOG_LEVEL as LogLevel) || 'info';
    this.logDir = path.join(process.cwd(), '.grok', 'logs');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private async writeToFile(entry: string): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      const logFile = path.join(this.logDir, `grok-${new Date().toISOString().split('T')[0]}.log`);
      await fs.appendFile(logFile, entry + '\n');
    } catch {
      // Silently fail - logging should never break the app
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      const entry = this.format('debug', message, data);
      console.debug(entry);
      this.writeToFile(entry);
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      const entry = this.format('info', message, data);
      console.info(entry);
      this.writeToFile(entry);
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      const entry = this.format('warn', message, data);
      console.warn(entry);
      this.writeToFile(entry);
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      const entry = this.format('error', message, data);
      console.error(entry);
      this.writeToFile(entry);
    }
  }
}

export const logger = new Logger();
```

### Step 1.7: Create Context Loader

Create `src/context/context-loader.ts`:
```typescript
import { promises as fs } from 'fs';
import path from 'path';

const CONTEXT_FILENAMES = ['GROK.md', 'grok.md'];

export async function loadContext(cwd: string = process.cwd()): Promise<string> {
  const contexts: string[] = [];

  // Walk up directory tree looking for GROK.md files
  let currentDir = cwd;
  const visitedDirs: string[] = [];

  while (true) {
    visitedDirs.push(currentDir);

    for (const filename of CONTEXT_FILENAMES) {
      const contextPath = path.join(currentDir, filename);
      try {
        const content = await fs.readFile(contextPath, 'utf-8');
        contexts.unshift(content); // Add parent contexts first
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check .grok/context/ folder
    const contextFolder = path.join(currentDir, '.grok', 'context');
    try {
      const files = await fs.readdir(contextFolder);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(contextFolder, file), 'utf-8');
          contexts.push(`\n# Context: ${file}\n${content}`);
        }
      }
    } catch {
      // Folder doesn't exist, continue
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return contexts.join('\n\n---\n\n');
}

export async function processImports(content: string, basePath: string): Promise<string> {
  // Process @import directives
  const importRegex = /@import\s+["'](.+?)["']/g;
  let result = content;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = path.resolve(basePath, match[1]);
    try {
      const importedContent = await fs.readFile(importPath, 'utf-8');
      result = result.replace(match[0], importedContent);
    } catch {
      console.warn(`Warning: Could not import ${importPath}`);
    }
  }

  return result;
}
```

### Step 1.8: Create Agent Loop

Create `src/agent/grok-agent.ts`:
```typescript
import OpenAI from 'openai';
import { GrokClient } from '../client/grok-client.js';
import { tools, getTool, getToolDefinitions } from '../tools/index.js';
import { loadContext } from '../context/context-loader.js';
import { requiresConfirmation, ConfirmationHandler } from '../security/permission-manager.js';

export interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_result' | 'error' | 'done';
  content?: string;
  tool?: string;
  result?: unknown;
  error?: string;
}

export interface AgentOptions {
  model?: string;
  maxRounds?: number;
  cwd?: string;
}

type Message = OpenAI.Chat.ChatCompletionMessageParam;
type ToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

export class GrokAgent {
  private client: GrokClient;
  private messages: Message[] = [];
  private maxRounds: number;
  private cwd: string;

  constructor(options: AgentOptions = {}) {
    this.client = new GrokClient({ model: options.model });
    this.maxRounds = options.maxRounds || 100;
    this.cwd = options.cwd || process.cwd();
  }

  /**
   * Run the agent with a prompt
   * @param prompt - User's input prompt
   * @param onConfirmation - Optional callback for permission requests (for Ink UI)
   */
  async *run(
    prompt: string,
    onConfirmation?: ConfirmationHandler
  ): AsyncGenerator<AgentEvent> {
    try {
      // Load context from GROK.md files
      const context = await loadContext(this.cwd);

      // Initialize messages
      this.messages = [];

      if (context) {
        this.messages.push({
          role: 'system',
          content: `You are Grok, an AI coding assistant. Follow the instructions below:\n\n${context}`,
        });
      } else {
        this.messages.push({
          role: 'system',
          content: 'You are Grok, an AI coding assistant. Help the user with their coding tasks.',
        });
      }

      this.messages.push({ role: 'user', content: prompt });

      // Agent loop
      for (let round = 0; round < this.maxRounds; round++) {
        const stream = await this.client.openai.chat.completions.create({
          model: this.client.model,
          messages: this.messages,
          tools: getToolDefinitions(),
          stream: true,
        });

        let responseContent = '';
        let toolCalls: ToolCall[] = [];

        // Process stream
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            responseContent += delta.content;
            yield { type: 'text', content: delta.content };
          }

          if (delta?.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index;

              if (!toolCalls[index]) {
                toolCalls[index] = {
                  id: toolCallDelta.id || '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }

              if (toolCallDelta.id) {
                toolCalls[index].id = toolCallDelta.id;
              }
              if (toolCallDelta.function?.name) {
                toolCalls[index].function.name += toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                toolCalls[index].function.arguments += toolCallDelta.function.arguments;
              }
            }
          }
        }

        // Filter out empty tool calls
        toolCalls = toolCalls.filter(tc => tc.id && tc.function.name);

        // If there are tool calls, execute them
        if (toolCalls.length > 0) {
          this.messages.push({
            role: 'assistant',
            content: responseContent || null,
            tool_calls: toolCalls,
          });

          for (const toolCall of toolCalls) {
            yield { type: 'tool_start', tool: toolCall.function.name };

            try {
              const args = JSON.parse(toolCall.function.arguments);
              const tool = getTool(toolCall.function.name);

              if (!tool) {
                const errorResult = { success: false, error: `Unknown tool: ${toolCall.function.name}` };
                yield { type: 'tool_result', tool: toolCall.function.name, result: errorResult };
                this.messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(errorResult),
                });
                continue;
              }

              // Check if confirmation is needed
              if (tool.requiresConfirmation || requiresConfirmation(tool.name)) {
                // Use callback if provided (Ink UI), otherwise auto-deny
                const allowed = onConfirmation
                  ? await onConfirmation(tool.name, args)
                  : false;

                if (!allowed) {
                  const deniedResult = { success: false, error: 'User denied permission' };
                  yield { type: 'tool_result', tool: tool.name, result: deniedResult };
                  this.messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(deniedResult),
                  });
                  continue;
                }
              }

              const result = await tool.execute(args);
              yield { type: 'tool_result', tool: tool.name, result };

              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              const errorResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Tool execution failed',
              };
              yield { type: 'tool_result', tool: toolCall.function.name, result: errorResult };
              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(errorResult),
              });
            }
          }
        } else {
          // No tool calls - we're done
          this.messages.push({ role: 'assistant', content: responseContent });
          yield { type: 'done' };
          return;
        }
      }

      yield { type: 'error', error: 'Maximum rounds exceeded' };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Agent execution failed',
      };
    }
  }
}
```

### Step 1.9: Create CLI Entry Point

Create `src/index.ts`:
```typescript
#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { App } from './ui/app.js';

// Parse CLI args
const args = process.argv.slice(2);
const prompt = args.filter(a => !a.startsWith('-')).join(' ');
const model = args.includes('--model')
  ? args[args.indexOf('--model') + 1]
  : 'grok-4-1-fast';

render(<App initialPrompt={prompt} model={model} />);
```

### Step 1.10: Create Ink UI Components (Anti-Flickering Optimized)

**Anti-Flickering Strategy:**
The Claude Code flickering bug is caused by excessive re-renders on every streaming token. We prevent this with:
1. **Text buffering** - Batch streaming updates (every 50ms instead of per-character)
2. **Static component** - Use Ink's `Static` for completed content that never changes
3. **Memoization** - `React.memo()` on child components to prevent cascade re-renders
4. **Stable keys** - Use stable IDs for list items, not array indices

Create `src/ui/app.tsx`:
```typescript
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useApp, useInput, Static } from 'ink';
import { GrokAgent, AgentEvent } from '../agent/grok-agent.js';
import { MessageDisplay } from './components/message.js';
import { ToolOutput } from './components/tool-output.js';
import { InputPrompt } from './components/input.js';
import { Spinner } from './components/spinner.js';
import { ConfirmDialog } from './components/confirm.js';
import { TodoDisplay } from './components/todo-display.js';
import { TodoTool } from '../tools/todo.js';

interface AppProps {
  initialPrompt?: string;
  model?: string;
}

type AppState = 'idle' | 'running' | 'waiting_input' | 'confirming';

interface Message {
  id: string;
  role: string;
  content: string;
}

interface ToolOutputItem {
  id: string;
  tool: string;
  result: unknown;
  completed: boolean;
}

interface PendingConfirmation {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

// Generate stable IDs
let messageIdCounter = 0;
const generateId = () => `msg-${++messageIdCounter}`;

export function App({ initialPrompt, model }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(initialPrompt ? 'running' : 'idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [toolOutputs, setToolOutputs] = useState<ToolOutputItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [agent] = useState(() => new GrokAgent({ model }));

  // Anti-flickering: Buffer for streaming text
  const textBufferRef = useRef('');
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Flush buffered text to state (batched updates prevent flickering)
  const flushBuffer = useCallback(() => {
    if (textBufferRef.current) {
      setStreamingText(prev => prev + textBufferRef.current);
      textBufferRef.current = '';
    }
    flushTimerRef.current = null;
  }, []);

  // Add text to buffer with debounced flush (50ms batching)
  const appendText = useCallback((text: string) => {
    textBufferRef.current += text;
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushBuffer, 50);
    }
  }, [flushBuffer]);

  // Handle confirmation dialog
  const handleConfirmation = useCallback((toolName: string, args: Record<string, unknown>): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingConfirm({ toolName, args, resolve });
      setState('confirming');
    });
  }, []);

  // Process agent events
  const runAgent = useCallback(async (prompt: string) => {
    setState('running');
    setStreamingText('');
    setToolOutputs([]);
    setError(null);
    textBufferRef.current = '';

    try {
      for await (const event of agent.run(prompt, handleConfirmation)) {
        switch (event.type) {
          case 'text':
            // Use buffered append to prevent per-character re-renders
            appendText(event.content || '');
            break;
          case 'tool_start':
            const toolId = generateId();
            setToolOutputs(prev => [...prev, {
              id: toolId,
              tool: event.tool!,
              result: 'running...',
              completed: false
            }]);
            break;
          case 'tool_result':
            setToolOutputs(prev => prev.map(t =>
              t.tool === event.tool && !t.completed
                ? { ...t, result: event.result, completed: true }
                : t
            ));
            break;
          case 'error':
            setError(event.error || 'Unknown error');
            break;
          case 'done':
            // Final flush before completing
            flushBuffer();
            // Move streaming text to messages
            setStreamingText(current => {
              if (current) {
                setMessages(prev => [...prev, {
                  id: generateId(),
                  role: 'assistant',
                  content: current
                }]);
              }
              return '';
            });
            setState('idle');
            break;
        }
      }
    } catch (err) {
      flushBuffer();
      setError(err instanceof Error ? err.message : 'Agent failed');
      setState('idle');
    }
  }, [agent, handleConfirmation, appendText, flushBuffer]);

  // Run initial prompt
  useEffect(() => {
    if (initialPrompt) {
      setMessages([{ id: generateId(), role: 'user', content: initialPrompt }]);
      runAgent(initialPrompt);
    }
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  // Handle user input
  const handleSubmit = useCallback((value: string) => {
    if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
      exit();
      return;
    }
    setMessages(prev => [...prev, { id: generateId(), role: 'user', content: value }]);
    runAgent(value);
  }, [exit, runAgent]);

  // Handle confirmation response
  const handleConfirmResponse = useCallback((approved: boolean) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(approved);
      setPendingConfirm(null);
      setState('running');
    }
  }, [pendingConfirm]);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  // Memoized completed content (messages + completed tools)
  const completedMessages = useMemo(() =>
    messages.filter(m => m.role !== 'streaming'),
    [messages]
  );

  const completedTools = useMemo(() =>
    toolOutputs.filter(t => t.completed),
    [toolOutputs]
  );

  const pendingTools = useMemo(() =>
    toolOutputs.filter(t => !t.completed),
    [toolOutputs]
  );

  const todos = TodoTool.getTodos();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header - static, never re-renders */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>⚡ grok-cli</Text>
        <Text color="gray"> - Claude Code for xAI Grok</Text>
      </Box>

      {/* Todo Display */}
      {todos.length > 0 && <TodoDisplay todos={todos} />}

      {/* Static: Completed messages - these NEVER cause re-renders */}
      <Static items={completedMessages}>
        {(msg) => (
          <MessageDisplay key={msg.id} role={msg.role} content={msg.content} />
        )}
      </Static>

      {/* Static: Completed tool outputs */}
      <Static items={completedTools}>
        {(t) => (
          <ToolOutput key={t.id} toolName={t.tool} result={t.result} />
        )}
      </Static>

      {/* Dynamic: Pending tool outputs */}
      {pendingTools.map((t) => (
        <ToolOutput key={t.id} toolName={t.tool} result={t.result} />
      ))}

      {/* Streaming text - only this updates frequently */}
      {streamingText && (
        <Box marginY={1}>
          <Text color="green">{streamingText}</Text>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box marginY={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Confirmation dialog */}
      {state === 'confirming' && pendingConfirm && (
        <ConfirmDialog
          toolName={pendingConfirm.toolName}
          args={pendingConfirm.args}
          onResponse={handleConfirmResponse}
        />
      )}

      {/* Loading spinner */}
      {state === 'running' && !pendingConfirm && <Spinner text="Thinking..." />}

      {/* Input prompt */}
      {state === 'idle' && (
        <InputPrompt onSubmit={handleSubmit} />
      )}
    </Box>
  );
}
```

Create `src/ui/components/message.tsx`:
```typescript
import React, { memo } from 'react';
import { Box, Text } from 'ink';

interface MessageDisplayProps {
  role: string;
  content: string;
}

// React.memo prevents re-renders when props haven't changed
export const MessageDisplay = memo(function MessageDisplay({ role, content }: MessageDisplayProps) {
  const isUser = role === 'user';

  return (
    <Box marginY={1} flexDirection="column">
      <Text color={isUser ? 'blue' : 'green'} bold>
        {isUser ? '👤 You' : '⚡ Grok'}
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
});
```

Create `src/ui/components/tool-output.tsx`:
```typescript
import React, { memo } from 'react';
import { Box, Text } from 'ink';

interface ToolOutputProps {
  toolName: string;
  result: unknown;
}

// Memoized to prevent re-renders when tool output hasn't changed
export const ToolOutput = memo(function ToolOutput({ toolName, result }: ToolOutputProps) {
  const isRunning = result === 'running...';
  const resultObj = result as { success?: boolean; output?: string; error?: string };
  const success = resultObj?.success ?? false;

  return (
    <Box marginY={1} flexDirection="column">
      <Box>
        <Text color="yellow">[{toolName}] </Text>
        {isRunning ? (
          <Text color="gray">running...</Text>
        ) : success ? (
          <Text color="green">✓ completed</Text>
        ) : (
          <Text color="red">✗ failed</Text>
        )}
      </Box>
      {!isRunning && resultObj?.output && (
        <Box marginLeft={2}>
          <Text color="gray" wrap="wrap">
            {resultObj.output.slice(0, 500)}
            {resultObj.output.length > 500 ? '...' : ''}
          </Text>
        </Box>
      )}
      {!isRunning && resultObj?.error && (
        <Box marginLeft={2}>
          <Text color="red">{resultObj.error}</Text>
        </Box>
      )}
    </Box>
  );
});
```

Create `src/ui/components/spinner.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface SpinnerProps {
  text?: string;
}

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function Spinner({ text = 'Loading...' }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box>
      <Text color="cyan">{frames[frame]} </Text>
      <Text color="gray">{text}</Text>
    </Box>
  );
}
```

Create `src/ui/components/confirm.tsx`:
```typescript
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ConfirmDialogProps {
  toolName: string;
  args: Record<string, unknown>;
  onResponse: (approved: boolean) => void;
}

export function ConfirmDialog({ toolName, args, onResponse }: ConfirmDialogProps) {
  useInput((input) => {
    if (input.toLowerCase() === 'y') {
      onResponse(true);
    } else if (input.toLowerCase() === 'n' || input === '\r') {
      onResponse(false);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>⚠️  Permission Required</Text>
      <Box marginY={1}>
        <Text>Tool: </Text>
        <Text color="cyan" bold>{toolName}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="gray">{JSON.stringify(args, null, 2).slice(0, 200)}</Text>
      </Box>
      <Box>
        <Text>Allow? </Text>
        <Text color="green">[y]es</Text>
        <Text> / </Text>
        <Text color="red">[n]o</Text>
      </Box>
    </Box>
  );
}
```

Create `src/ui/components/input.tsx`:
```typescript
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputPromptProps {
  onSubmit: (value: string) => void;
}

export function InputPrompt({ onSubmit }: InputPromptProps) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue('');
      }
    } else if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      setValue(prev => prev + input);
    }
  });

  return (
    <Box marginTop={1}>
      <Text color="blue" bold>❯ </Text>
      <Text>{value}</Text>
      <Text color="gray">▌</Text>
    </Box>
  );
}
```

Create `src/ui/components/todo-display.tsx`:
```typescript
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { TodoItem } from '../../tools/todo.js';

interface TodoDisplayProps {
  todos: TodoItem[];
}

// Memoized - only re-renders when todos array changes
export const TodoDisplay = memo(function TodoDisplay({ todos }: TodoDisplayProps) {
  if (todos.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1} marginBottom={1}>
      <Text color="gray" bold>📋 Tasks</Text>
      {todos.map((todo, i) => (
        <Box key={`todo-${i}-${todo.content.slice(0, 10)}`}>
          <Text color={
            todo.status === 'completed' ? 'green' :
            todo.status === 'in_progress' ? 'yellow' :
            'gray'
          }>
            {todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '→' : '○'}{' '}
          </Text>
          <Text color={todo.status === 'completed' ? 'gray' : 'white'}>
            {todo.status === 'in_progress' ? todo.activeForm : todo.content}
          </Text>
        </Box>
      ))}
    </Box>
  );
});
```

### Step 1.11: Phase 1 Verification Checklist

After completing Phase 1, verify:

- [ ] `npm run dev "Hello, what can you do?"` - Basic conversation works
- [ ] `npm run dev "Read the file package.json"` - Read tool works (auto-approved)
- [ ] `npm run dev "Create a file test.txt with hello world"` - Write tool asks for confirmation
- [ ] `npm run dev "Run npm --version"` - Bash tool asks for confirmation
- [ ] `npm run dev "Find all TypeScript files"` - Glob tool works
- [ ] `npm run dev "Search for 'function' in src/"` - Grep tool works
- [ ] Path traversal attempts are blocked
- [ ] Dangerous commands are blocked

---

## Phase 2: Sessions, Hooks, TTS

**Goal**: Add session persistence, hooks, and TTS
**Effort**: 6-8 hours

### Step 2.1: Session Storage

Create `src/session/session-storage.ts`:
```typescript
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: unknown[];
  metadata?: Record<string, unknown>;
}

export class SessionStorage {
  private baseDir: string;
  private isGlobal: boolean;

  constructor(global: boolean = false) {
    this.isGlobal = global;
    this.baseDir = global
      ? path.join(process.env.HOME || '', '.grok', 'sessions')
      : path.join(process.cwd(), '.grok', 'sessions');
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async save(session: Session): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.baseDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  async load(sessionId: string): Promise<Session | null> {
    const filePath = path.join(this.baseDir, `${sessionId}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async getLatest(): Promise<Session | null> {
    try {
      await this.ensureDir();
      const files = await fs.readdir(this.baseDir);
      const sessions = files.filter(f => f.endsWith('.json'));

      if (sessions.length === 0) return null;

      // Sort by modification time
      const withStats = await Promise.all(
        sessions.map(async (f) => {
          const stat = await fs.stat(path.join(this.baseDir, f));
          return { file: f, mtime: stat.mtime };
        })
      );

      withStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      return this.load(withStats[0].file.replace('.json', ''));
    } catch {
      return null;
    }
  }

  async list(): Promise<string[]> {
    try {
      await this.ensureDir();
      const files = await fs.readdir(this.baseDir);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  static generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }
}
```

### Step 2.2: Hook System

Create `src/hooks/hook-types.ts`:
```typescript
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreRequest'
  | 'PostRequest'
  | 'Error'
  | 'UserInput';

export interface HookPayload {
  event: HookEvent;
  data: unknown;
  sessionId?: string;
  timestamp: string;
}

export interface HookConfig {
  command: string;
  events: HookEvent[];
  timeout?: number;
}
```

Create `src/hooks/hook-manager.ts`:
```typescript
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { HookEvent, HookPayload, HookConfig } from './hook-types.js';

export class HookManager {
  private hooks: HookConfig[] = [];
  private loaded = false;

  async loadHooks(): Promise<void> {
    if (this.loaded) return;

    const configPaths = [
      path.join(process.cwd(), '.grok', 'hooks.json'),
      path.join(process.env.HOME || '', '.grok', 'hooks.json'),
    ];

    for (const configPath of configPaths) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (Array.isArray(config.hooks)) {
          this.hooks.push(...config.hooks);
        }
      } catch {
        // Config doesn't exist, continue
      }
    }

    this.loaded = true;
  }

  async trigger(event: HookEvent, data: unknown, sessionId?: string): Promise<void> {
    await this.loadHooks();

    const payload: HookPayload = {
      event,
      data,
      sessionId,
      timestamp: new Date().toISOString(),
    };

    const matchingHooks = this.hooks.filter(h => h.events.includes(event));

    for (const hook of matchingHooks) {
      try {
        await this.executeHook(hook, payload);
      } catch (error) {
        console.error(`Hook error (${event}):`, error);
      }
    }
  }

  private executeHook(hook: HookConfig, payload: HookPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', hook.command], {
        env: {
          ...process.env,
          GROK_HOOK_EVENT: payload.event,
          GROK_HOOK_DATA: JSON.stringify(payload.data),
          GROK_SESSION_ID: payload.sessionId || '',
        },
        timeout: hook.timeout || 5000,
      });

      child.on('close', () => resolve());
      child.on('error', reject);
    });
  }
}
```

### Step 2.3: TTS Integration

Create `src/lib/tts.ts`:
```typescript
import { spawn } from 'child_process';
import path from 'path';

export async function speak(text: string): Promise<void> {
  // Path to AgentVibes TTS script
  const ttsScript = path.join(process.cwd(), '.claude', 'hooks', 'play-tts.sh');

  return new Promise((resolve, reject) => {
    const child = spawn('bash', [ttsScript, text], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // TTS failed silently - not critical
        resolve();
      }
    });

    child.on('error', () => {
      // TTS not available - continue silently
      resolve();
    });
  });
}
```

---

## Phase 3: Subagents, MCP, Web Tools

**Goal**: Full Claude Code feature parity
**Effort**: 8-12 hours

### Step 3.1: Subagent Tool

Create `src/agent/subagent.ts` and `src/tools/task.ts` - spawn child GrokAgent instances.

### Step 3.2: MCP Integration

Create `src/mcp/mcp-manager.ts` - connect to MCP servers defined in `.grok/settings.json`.

### Step 3.3: Web Tools

Register xAI's built-in `web_search` and `x_search` tools.

---

## CLI Interface Reference

```bash
# Basic usage
grok "Fix the bug in app.ts"

# Flags
grok --model grok-4 "Complex task"
grok --resume                    # Continue last session
grok --session abc123            # Resume specific session
grok --global                    # Use ~/.grok/ storage
grok --no-tts                    # Disable voice
grok --plan                      # Read-only mode
grok --yolo                      # No confirmations

# Session commands
grok sessions list
grok sessions clear
grok sessions export abc123

# Config commands
grok config set model grok-4-1-fast
grok config set tts true
```

---

## Success Criteria

### Phase 1 (Must Pass)
- [ ] `grok "Hello"` returns a response
- [ ] Token streaming works
- [ ] Read/Glob/Grep auto-approved
- [ ] Write/Edit/Bash require confirmation
- [ ] GROK.md context loads
- [ ] Path traversal blocked
- [ ] Dangerous commands blocked

### Phase 2 (Must Pass)
- [ ] Sessions persist and resume
- [ ] Hooks fire on events
- [ ] TTS speaks responses

### Phase 3 (Must Pass)
- [ ] Task tool spawns subagents
- [ ] MCP servers connect
- [ ] Web search works

---

## Troubleshooting

### "Missing API key" Error
```bash
export GROK_API_KEY="xai-your-key-here"
# or
export XAI_API_KEY="xai-your-key-here"
```

### "ripgrep not found" Error
```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
sudo apt install ripgrep

# Windows
choco install ripgrep
```

### Permission Denied on TTS
```bash
chmod +x .claude/hooks/play-tts.sh
```

---

## Notes for Executing Claude

1. **Build incrementally** - complete Phase 1 fully before Phase 2
2. **Test each tool** after creation before moving on
3. **Verify security** - test path traversal and command injection blocks
4. **Keep it standalone** - no automaker imports
5. **Follow the structure** - use exact file paths specified

---

*Generated by Claude Opus 4.5 with ULTRATHINK*
