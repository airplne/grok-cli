# PRP: Phase 1 - Command Infrastructure + Essential Commands

**Created**: 2026-01-03
**Author**: Claude Opus 4.5
**Status**: Ready for Execution
**Estimated Effort**: 4-6 hours

---

## Executive Summary

Implement a complete slash command system for grok-cli that provides user-facing commands separate from AI tools. This phase establishes the command infrastructure (types, parser, registry) and implements 5 essential commands: `/help`, `/model`, `/clear`, `/exit`, and `/history`.

**Key Design Decisions:**
- Commands are user-facing (start with `/`), tools are AI-facing
- Commands execute synchronously and immediately return results
- Parser handles command detection, argument extraction, and validation
- Registry pattern allows easy addition of new commands
- Model configuration supports all 5 xAI Grok models

---

## Requirements

### Phase 1 Scope

| Component | Files | Description |
|-----------|-------|-------------|
| Command Types | `src/commands/types.ts` | Interfaces for commands, arguments, results |
| Command Parser | `src/commands/parser.ts` | Parse `/command arg1 arg2` syntax |
| Command Registry | `src/commands/index.ts` | Register and dispatch commands |
| Model Config | `src/config/models.ts` | All 5 Grok model definitions |
| /help Handler | `src/commands/handlers/help.ts` | Display available commands |
| /model Handler | `src/commands/handlers/model.ts` | Switch/display current model |
| /clear Handler | `src/commands/handlers/clear.ts` | Clear conversation history |
| /exit Handler | `src/commands/handlers/exit.ts` | Exit the CLI gracefully |
| /history Handler | `src/commands/handlers/history.ts` | Display conversation history |
| UI Updates | `src/ui/app.tsx` | Integrate command routing |
| CLI Updates | `src/index.tsx` | Add CLI flags for model selection |

### Command Specifications

| Command | Syntax | Description |
|---------|--------|-------------|
| `/help` | `/help [command]` | Show all commands or help for specific command |
| `/model` | `/model [name]` | Show current model or switch to new model |
| `/clear` | `/clear` | Clear conversation history |
| `/exit` | `/exit` | Exit grok-cli |
| `/history` | `/history [count]` | Show last N messages (default: 10) |

### Model Specifications

| Model ID | Display Name | Context | Description |
|----------|--------------|---------|-------------|
| `grok-3-beta` | Grok 3 Beta | 128K | Most capable model |
| `grok-3-fast-beta` | Grok 3 Fast Beta | 128K | Faster, less capable |
| `grok-3-mini-beta` | Grok 3 Mini Beta | 128K | Small, fast model |
| `grok-3-mini-fast-beta` | Grok 3 Mini Fast Beta | 128K | Fastest mini model |
| `grok-4-1-fast` | Grok 4.1 Fast | 2M | Default - best value |

---

## Project Structure

Files to create/modify for Phase 1:

```
src/
├── commands/
│   ├── types.ts           # NEW: Command interfaces
│   ├── parser.ts          # NEW: Command parser
│   ├── index.ts           # NEW: Command registry
│   └── handlers/
│       ├── help.ts        # NEW: /help command
│       ├── model.ts       # NEW: /model command
│       ├── clear.ts       # NEW: /clear command
│       ├── exit.ts        # NEW: /exit command
│       └── history.ts     # NEW: /history command
├── config/
│   └── models.ts          # NEW: Model definitions
├── ui/
│   └── app.tsx            # MODIFY: Add command routing
└── index.tsx              # MODIFY: Add CLI flags
```

---

## Step-by-Step Implementation

### Step 1: Create Command Types

Create `src/commands/types.ts`:

```typescript
/**
 * Command System Types
 *
 * Defines the interfaces for the slash command system.
 * Commands are user-facing operations (like /help, /model) that execute
 * synchronously without involving the AI agent.
 */

/**
 * Result of executing a command
 */
export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Output message to display to the user */
  output?: string;
  /** Error message if command failed */
  error?: string;
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Special action to perform after command */
  action?: CommandAction;
}

/**
 * Special actions a command can trigger
 */
export type CommandAction =
  | { type: 'exit' }
  | { type: 'clear' }
  | { type: 'set_model'; model: string }
  | { type: 'none' };

/**
 * Parsed command with extracted arguments
 */
export interface ParsedCommand {
  /** Command name without the leading slash */
  name: string;
  /** Raw argument string after the command */
  rawArgs: string;
  /** Parsed positional arguments */
  args: string[];
  /** Parsed named arguments (--key=value or --flag) */
  flags: Record<string, string | boolean>;
}

/**
 * Argument definition for a command
 */
export interface CommandArgument {
  /** Argument name */
  name: string;
  /** Description for help text */
  description: string;
  /** Whether this argument is required */
  required: boolean;
  /** Default value if not provided */
  defaultValue?: string | number | boolean;
  /** Type of the argument */
  type: 'string' | 'number' | 'boolean';
}

/**
 * Command definition interface
 * All command handlers must implement this interface
 */
export interface Command {
  /** Command name (without leading slash) */
  name: string;
  /** Short description for help listing */
  description: string;
  /** Detailed usage information */
  usage: string;
  /** Command argument definitions */
  arguments: CommandArgument[];
  /** Example usages */
  examples: string[];
  /** Command aliases (e.g., 'q' for 'exit') */
  aliases: string[];

  /**
   * Execute the command
   * @param args - Parsed command arguments
   * @param context - Execution context with app state access
   * @returns Command result
   */
  execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult>;
}

/**
 * Context passed to command handlers
 * Provides access to application state and utilities
 */
export interface CommandContext {
  /** Current model name */
  currentModel: string;
  /** Set the current model */
  setModel: (model: string) => void;
  /** Get conversation history */
  getHistory: () => HistoryMessage[];
  /** Clear conversation history */
  clearHistory: () => void;
  /** Exit the application */
  exit: () => void;
  /** Current working directory */
  cwd: string;
}

/**
 * Message in conversation history
 */
export interface HistoryMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp when message was created */
  timestamp: Date;
  /** Model used for assistant messages */
  model?: string;
}

/**
 * Parser result type
 */
export type ParseResult =
  | { type: 'command'; command: ParsedCommand }
  | { type: 'message'; content: string }
  | { type: 'empty' };
```

---

### Step 2: Create Command Parser

Create `src/commands/parser.ts`:

```typescript
/**
 * Command Parser
 *
 * Parses user input to detect and extract slash commands.
 * Handles command detection, argument parsing, and flag extraction.
 */

import type { ParsedCommand, ParseResult } from './types.js';

/**
 * Check if input starts with a slash command
 */
export function isCommand(input: string): boolean {
  const trimmed = input.trim();
  // Must start with / followed by a letter (not //)
  return /^\/[a-zA-Z]/.test(trimmed);
}

/**
 * Parse a command string into structured format
 *
 * Supports:
 * - Positional arguments: /command arg1 arg2
 * - Quoted arguments: /command "arg with spaces"
 * - Named flags: /command --flag=value
 * - Boolean flags: /command --verbose
 *
 * @param input - Raw user input string
 * @returns Parsed command structure
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  // Remove leading slash
  const withoutSlash = trimmed.slice(1);

  // Split into command name and rest
  const firstSpaceIndex = withoutSlash.indexOf(' ');
  const name = firstSpaceIndex === -1
    ? withoutSlash.toLowerCase()
    : withoutSlash.slice(0, firstSpaceIndex).toLowerCase();

  const rawArgs = firstSpaceIndex === -1
    ? ''
    : withoutSlash.slice(firstSpaceIndex + 1).trim();

  // Parse arguments and flags
  const { args, flags } = parseArguments(rawArgs);

  return {
    name,
    rawArgs,
    args,
    flags,
  };
}

/**
 * Parse argument string into positional args and named flags
 */
function parseArguments(rawArgs: string): { args: string[]; flags: Record<string, string | boolean> } {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  if (!rawArgs) {
    return { args, flags };
  }

  // Tokenize respecting quotes
  const tokens = tokenize(rawArgs);

  for (const token of tokens) {
    if (token.startsWith('--')) {
      // Named flag
      const flagContent = token.slice(2);
      const equalsIndex = flagContent.indexOf('=');

      if (equalsIndex === -1) {
        // Boolean flag: --verbose
        flags[flagContent] = true;
      } else {
        // Value flag: --model=grok-4
        const key = flagContent.slice(0, equalsIndex);
        const value = flagContent.slice(equalsIndex + 1);
        flags[key] = value;
      }
    } else if (token.startsWith('-') && token.length === 2) {
      // Short flag: -v (treat as boolean)
      flags[token.slice(1)] = true;
    } else {
      // Positional argument
      args.push(token);
    }
  }

  return { args, flags };
}

/**
 * Tokenize a string respecting quoted sections
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
    } else if (!inQuotes && char === ' ') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse user input and determine if it's a command or regular message
 */
export function parseInput(input: string): ParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'empty' };
  }

  if (isCommand(trimmed)) {
    return { type: 'command', command: parseCommand(trimmed) };
  }

  return { type: 'message', content: trimmed };
}

/**
 * Format a command for display (e.g., in help text)
 */
export function formatCommandSignature(name: string, args: { name: string; required: boolean }[]): string {
  const argParts = args.map(arg =>
    arg.required ? `<${arg.name}>` : `[${arg.name}]`
  );
  return `/${name}${argParts.length > 0 ? ' ' + argParts.join(' ') : ''}`;
}

// ============================================================================
// TESTS - Run with: npx tsx src/commands/parser.ts
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running parser tests...\n');

  const tests = [
    // Basic command detection
    { input: '/help', expected: { name: 'help', args: [], flags: {} } },
    { input: '/model grok-4', expected: { name: 'model', args: ['grok-4'], flags: {} } },
    { input: '  /exit  ', expected: { name: 'exit', args: [], flags: {} } },

    // Not commands
    { input: 'hello', isCommand: false },
    { input: '// comment', isCommand: false },
    { input: '/123', isCommand: false },

    // Arguments
    { input: '/history 20', expected: { name: 'history', args: ['20'], flags: {} } },
    { input: '/model grok-3-beta', expected: { name: 'model', args: ['grok-3-beta'], flags: {} } },

    // Quoted arguments
    { input: '/echo "hello world"', expected: { name: 'echo', args: ['hello world'], flags: {} } },
    { input: "/echo 'single quotes'", expected: { name: 'echo', args: ['single quotes'], flags: {} } },

    // Flags
    { input: '/help --verbose', expected: { name: 'help', args: [], flags: { verbose: true } } },
    { input: '/model --set=grok-4', expected: { name: 'model', args: [], flags: { set: 'grok-4' } } },
    { input: '/test -v', expected: { name: 'test', args: [], flags: { v: true } } },

    // Mixed
    { input: '/cmd arg1 --flag arg2', expected: { name: 'cmd', args: ['arg1', 'arg2'], flags: { flag: true } } },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    if ('isCommand' in test) {
      const result = isCommand(test.input);
      if (result === test.isCommand) {
        console.log(`PASS: isCommand("${test.input}") = ${result}`);
        passed++;
      } else {
        console.log(`FAIL: isCommand("${test.input}") expected ${test.isCommand}, got ${result}`);
        failed++;
      }
    } else if ('expected' in test) {
      const result = parseCommand(test.input);
      const matches =
        result.name === test.expected.name &&
        JSON.stringify(result.args) === JSON.stringify(test.expected.args) &&
        JSON.stringify(result.flags) === JSON.stringify(test.expected.flags);

      if (matches) {
        console.log(`PASS: parseCommand("${test.input}")`);
        passed++;
      } else {
        console.log(`FAIL: parseCommand("${test.input}")`);
        console.log(`  Expected: ${JSON.stringify(test.expected)}`);
        console.log(`  Got: ${JSON.stringify({ name: result.name, args: result.args, flags: result.flags })}`);
        failed++;
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
```

---

### Step 3: Create Model Configuration

Create `src/config/models.ts`:

```typescript
/**
 * Grok Model Configuration
 *
 * Defines all available xAI Grok models with their capabilities.
 * Reference: https://docs.x.ai/docs/models
 */

export interface ModelConfig {
  /** Model ID used in API calls */
  id: string;
  /** Human-friendly display name */
  displayName: string;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Model description */
  description: string;
  /** Input price per 1M tokens (USD) */
  inputPrice: number;
  /** Output price per 1M tokens (USD) */
  outputPrice: number;
  /** Whether this is the default model */
  isDefault: boolean;
  /** Model capabilities */
  capabilities: {
    functionCalling: boolean;
    streaming: boolean;
    vision: boolean;
  };
}

/**
 * All available Grok models
 */
export const GROK_MODELS: Record<string, ModelConfig> = {
  'grok-3-beta': {
    id: 'grok-3-beta',
    displayName: 'Grok 3 Beta',
    contextWindow: 128000,
    description: 'Most capable model for complex reasoning',
    inputPrice: 3.00,
    outputPrice: 15.00,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-3-fast-beta': {
    id: 'grok-3-fast-beta',
    displayName: 'Grok 3 Fast Beta',
    contextWindow: 128000,
    description: 'Faster variant of Grok 3',
    inputPrice: 0.60,
    outputPrice: 3.00,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-3-mini-beta': {
    id: 'grok-3-mini-beta',
    displayName: 'Grok 3 Mini Beta',
    contextWindow: 128000,
    description: 'Small model for simple tasks',
    inputPrice: 0.30,
    outputPrice: 0.50,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-3-mini-fast-beta': {
    id: 'grok-3-mini-fast-beta',
    displayName: 'Grok 3 Mini Fast Beta',
    contextWindow: 128000,
    description: 'Fastest mini model',
    inputPrice: 0.10,
    outputPrice: 0.40,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-4-1-fast': {
    id: 'grok-4-1-fast',
    displayName: 'Grok 4.1 Fast',
    contextWindow: 2000000,
    description: 'Latest model with 2M context - best value',
    inputPrice: 0.20,
    outputPrice: 0.50,
    isDefault: true,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: true,
    },
  },
};

/**
 * Model ID aliases for convenience
 */
export const MODEL_ALIASES: Record<string, string> = {
  'grok3': 'grok-3-beta',
  'grok-3': 'grok-3-beta',
  'grok3fast': 'grok-3-fast-beta',
  'grok3mini': 'grok-3-mini-beta',
  'grok3minifast': 'grok-3-mini-fast-beta',
  'grok4': 'grok-4-1-fast',
  'grok-4': 'grok-4-1-fast',
  'grok41': 'grok-4-1-fast',
  'grok-4-1': 'grok-4-1-fast',
  'fast': 'grok-4-1-fast',
  'default': 'grok-4-1-fast',
};

/**
 * Get the default model ID
 */
export function getDefaultModel(): string {
  const defaultModel = Object.values(GROK_MODELS).find(m => m.isDefault);
  return defaultModel?.id || 'grok-4-1-fast';
}

/**
 * Get model config by ID or alias
 * @param idOrAlias - Model ID or alias
 * @returns Model config or undefined if not found
 */
export function getModel(idOrAlias: string): ModelConfig | undefined {
  const normalizedId = idOrAlias.toLowerCase();

  // Check direct match
  if (GROK_MODELS[normalizedId]) {
    return GROK_MODELS[normalizedId];
  }

  // Check aliases
  const aliasedId = MODEL_ALIASES[normalizedId];
  if (aliasedId && GROK_MODELS[aliasedId]) {
    return GROK_MODELS[aliasedId];
  }

  return undefined;
}

/**
 * Resolve model ID from alias
 * @param idOrAlias - Model ID or alias
 * @returns Resolved model ID or original if not found
 */
export function resolveModelId(idOrAlias: string): string {
  const model = getModel(idOrAlias);
  return model?.id || idOrAlias;
}

/**
 * Check if a model ID is valid
 */
export function isValidModel(idOrAlias: string): boolean {
  return getModel(idOrAlias) !== undefined;
}

/**
 * Get all available model IDs
 */
export function getModelIds(): string[] {
  return Object.keys(GROK_MODELS);
}

/**
 * Format model for display
 */
export function formatModelDisplay(model: ModelConfig): string {
  const contextStr = model.contextWindow >= 1000000
    ? `${(model.contextWindow / 1000000).toFixed(0)}M`
    : `${(model.contextWindow / 1000).toFixed(0)}K`;

  return `${model.displayName} (${contextStr} context)`;
}

/**
 * Format model pricing for display
 */
export function formatModelPricing(model: ModelConfig): string {
  return `$${model.inputPrice.toFixed(2)}/$${model.outputPrice.toFixed(2)} per 1M tokens (in/out)`;
}
```

---

### Step 4: Create /help Command Handler

Create `src/commands/handlers/help.ts`:

```typescript
/**
 * /help Command Handler
 *
 * Displays available commands and their usage.
 * Usage: /help [command]
 */

import type { Command, CommandResult, ParsedCommand, CommandContext } from '../types.js';
import { formatCommandSignature } from '../parser.js';
import { getRegistry } from '../index.js';

export const helpCommand: Command = {
  name: 'help',
  description: 'Display available commands and their usage',
  usage: '/help [command]',
  arguments: [
    {
      name: 'command',
      description: 'Specific command to get help for',
      required: false,
      type: 'string',
    },
  ],
  examples: [
    '/help',
    '/help model',
    '/help history',
  ],
  aliases: ['h', '?'],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const registry = getRegistry();
    const commands = registry.getAllCommands();

    // If a specific command is requested
    if (args.args.length > 0) {
      const commandName = args.args[0].toLowerCase();
      const command = registry.getCommand(commandName);

      if (!command) {
        return {
          success: false,
          error: `Unknown command: /${commandName}\n\nUse /help to see available commands.`,
        };
      }

      return {
        success: true,
        output: formatCommandHelp(command),
        action: { type: 'none' },
      };
    }

    // Show all commands
    const output = formatAllCommands(commands);

    return {
      success: true,
      output,
      action: { type: 'none' },
    };
  },
};

/**
 * Format help text for all commands
 */
function formatAllCommands(commands: Command[]): string {
  const lines: string[] = [
    'Available Commands',
    '==================',
    '',
  ];

  // Calculate max command width for alignment
  const maxWidth = Math.max(...commands.map(c => c.name.length)) + 2;

  for (const cmd of commands) {
    const signature = formatCommandSignature(cmd.name, cmd.arguments);
    const padding = ' '.repeat(Math.max(1, maxWidth - cmd.name.length));
    lines.push(`  ${signature}${padding}${cmd.description}`);

    if (cmd.aliases.length > 0) {
      lines.push(`    Aliases: ${cmd.aliases.map(a => '/' + a).join(', ')}`);
    }
  }

  lines.push('');
  lines.push('Use /help <command> for more information about a specific command.');

  return lines.join('\n');
}

/**
 * Format detailed help for a single command
 */
function formatCommandHelp(command: Command): string {
  const lines: string[] = [
    `/${command.name}`,
    '='.repeat(command.name.length + 1),
    '',
    command.description,
    '',
    'Usage:',
    `  ${command.usage}`,
    '',
  ];

  if (command.arguments.length > 0) {
    lines.push('Arguments:');
    for (const arg of command.arguments) {
      const requiredStr = arg.required ? '(required)' : '(optional)';
      const defaultStr = arg.defaultValue !== undefined
        ? ` [default: ${arg.defaultValue}]`
        : '';
      lines.push(`  <${arg.name}> - ${arg.description} ${requiredStr}${defaultStr}`);
    }
    lines.push('');
  }

  if (command.aliases.length > 0) {
    lines.push(`Aliases: ${command.aliases.map(a => '/' + a).join(', ')}`);
    lines.push('');
  }

  if (command.examples.length > 0) {
    lines.push('Examples:');
    for (const example of command.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join('\n');
}

export default helpCommand;
```

---

### Step 5: Create /model Command Handler

Create `src/commands/handlers/model.ts`:

```typescript
/**
 * /model Command Handler
 *
 * Display current model or switch to a different model.
 * Usage: /model [name]
 */

import type { Command, CommandResult, ParsedCommand, CommandContext } from '../types.js';
import {
  GROK_MODELS,
  getModel,
  resolveModelId,
  isValidModel,
  formatModelDisplay,
  formatModelPricing,
  getDefaultModel,
} from '../../config/models.js';

export const modelCommand: Command = {
  name: 'model',
  description: 'Display current model or switch to a different model',
  usage: '/model [name]',
  arguments: [
    {
      name: 'name',
      description: 'Model name or alias to switch to',
      required: false,
      type: 'string',
    },
  ],
  examples: [
    '/model',
    '/model grok-3-beta',
    '/model grok4',
    '/model --list',
  ],
  aliases: ['m'],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    // Handle --list flag
    if (args.flags.list || args.flags.l) {
      return {
        success: true,
        output: formatModelList(context.currentModel),
        action: { type: 'none' },
      };
    }

    // No argument - show current model
    if (args.args.length === 0) {
      const currentConfig = getModel(context.currentModel);

      if (!currentConfig) {
        return {
          success: true,
          output: `Current model: ${context.currentModel} (unknown model)\n\nUse /model --list to see available models.`,
          action: { type: 'none' },
        };
      }

      return {
        success: true,
        output: formatCurrentModel(currentConfig),
        action: { type: 'none' },
      };
    }

    // Switch to specified model
    const requestedModel = args.args[0];

    if (!isValidModel(requestedModel)) {
      const availableModels = Object.keys(GROK_MODELS).join(', ');
      return {
        success: false,
        error: `Unknown model: ${requestedModel}\n\nAvailable models: ${availableModels}\n\nUse /model --list for details.`,
      };
    }

    const resolvedId = resolveModelId(requestedModel);
    const modelConfig = getModel(resolvedId)!;

    // Check if already using this model
    if (resolvedId === context.currentModel) {
      return {
        success: true,
        output: `Already using ${modelConfig.displayName}.`,
        action: { type: 'none' },
      };
    }

    // Update the model
    context.setModel(resolvedId);

    return {
      success: true,
      output: `Switched to ${modelConfig.displayName}\n\n${formatModelDisplay(modelConfig)}\n${formatModelPricing(modelConfig)}`,
      action: { type: 'set_model', model: resolvedId },
      data: { previousModel: context.currentModel, newModel: resolvedId },
    };
  },
};

/**
 * Format current model display
 */
function formatCurrentModel(model: import('../../config/models.js').ModelConfig): string {
  const lines: string[] = [
    'Current Model',
    '=============',
    '',
    `  ${model.displayName}`,
    `  ID: ${model.id}`,
    '',
    `  ${model.description}`,
    '',
    `  Context: ${formatContextWindow(model.contextWindow)}`,
    `  Pricing: ${formatModelPricing(model)}`,
    '',
    'Capabilities:',
    `  Function Calling: ${model.capabilities.functionCalling ? 'Yes' : 'No'}`,
    `  Streaming: ${model.capabilities.streaming ? 'Yes' : 'No'}`,
    `  Vision: ${model.capabilities.vision ? 'Yes' : 'No'}`,
    '',
    'Use /model <name> to switch models, or /model --list to see all available models.',
  ];

  return lines.join('\n');
}

/**
 * Format model list display
 */
function formatModelList(currentModelId: string): string {
  const lines: string[] = [
    'Available Models',
    '================',
    '',
  ];

  for (const [id, model] of Object.entries(GROK_MODELS)) {
    const isCurrent = id === currentModelId;
    const marker = isCurrent ? '>' : ' ';
    const defaultMarker = model.isDefault ? ' (default)' : '';

    lines.push(`${marker} ${model.displayName}${defaultMarker}`);
    lines.push(`    ID: ${model.id}`);
    lines.push(`    ${model.description}`);
    lines.push(`    Context: ${formatContextWindow(model.contextWindow)} | ${formatModelPricing(model)}`);
    lines.push('');
  }

  lines.push('Use /model <name> to switch to a different model.');

  return lines.join('\n');
}

/**
 * Format context window for display
 */
function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(0)}M tokens`;
  }
  return `${(tokens / 1000).toFixed(0)}K tokens`;
}

export default modelCommand;
```

---

### Step 6: Create /clear Command Handler

Create `src/commands/handlers/clear.ts`:

```typescript
/**
 * /clear Command Handler
 *
 * Clears the conversation history and resets the session.
 * Usage: /clear
 */

import type { Command, CommandResult, ParsedCommand, CommandContext } from '../types.js';

export const clearCommand: Command = {
  name: 'clear',
  description: 'Clear conversation history and start fresh',
  usage: '/clear',
  arguments: [],
  examples: [
    '/clear',
  ],
  aliases: ['c', 'cls', 'reset'],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    // Get message count before clearing
    const history = context.getHistory();
    const messageCount = history.length;

    // Clear the history
    context.clearHistory();

    return {
      success: true,
      output: messageCount > 0
        ? `Cleared ${messageCount} message(s). Starting fresh conversation.`
        : 'Conversation already empty. Ready for new messages.',
      action: { type: 'clear' },
      data: { clearedCount: messageCount },
    };
  },
};

export default clearCommand;
```

---

### Step 7: Create /exit Command Handler

Create `src/commands/handlers/exit.ts`:

```typescript
/**
 * /exit Command Handler
 *
 * Exits the grok-cli application gracefully.
 * Usage: /exit
 */

import type { Command, CommandResult, ParsedCommand, CommandContext } from '../types.js';

export const exitCommand: Command = {
  name: 'exit',
  description: 'Exit grok-cli',
  usage: '/exit',
  arguments: [],
  examples: [
    '/exit',
    '/quit',
    '/q',
  ],
  aliases: ['quit', 'q', 'bye'],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    // The actual exit is handled by the action
    return {
      success: true,
      output: 'Goodbye!',
      action: { type: 'exit' },
    };
  },
};

export default exitCommand;
```

---

### Step 8: Create /history Command Handler

Create `src/commands/handlers/history.ts`:

```typescript
/**
 * /history Command Handler
 *
 * Displays the conversation history.
 * Usage: /history [count]
 */

import type { Command, CommandResult, ParsedCommand, CommandContext, HistoryMessage } from '../types.js';

export const historyCommand: Command = {
  name: 'history',
  description: 'Display conversation history',
  usage: '/history [count]',
  arguments: [
    {
      name: 'count',
      description: 'Number of messages to display',
      required: false,
      defaultValue: 10,
      type: 'number',
    },
  ],
  examples: [
    '/history',
    '/history 20',
    '/history --all',
  ],
  aliases: ['hist', 'h'],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const history = context.getHistory();

    if (history.length === 0) {
      return {
        success: true,
        output: 'No conversation history yet. Start chatting!',
        action: { type: 'none' },
      };
    }

    // Determine how many messages to show
    let count: number;

    if (args.flags.all || args.flags.a) {
      count = history.length;
    } else if (args.args.length > 0) {
      const parsed = parseInt(args.args[0], 10);
      if (isNaN(parsed) || parsed < 1) {
        return {
          success: false,
          error: `Invalid count: ${args.args[0]}. Please provide a positive number.`,
        };
      }
      count = parsed;
    } else {
      count = 10;
    }

    // Get the last N messages
    const messagesToShow = history.slice(-count);
    const skipped = history.length - messagesToShow.length;

    return {
      success: true,
      output: formatHistory(messagesToShow, skipped, history.length),
      action: { type: 'none' },
      data: {
        totalMessages: history.length,
        displayedMessages: messagesToShow.length,
        skippedMessages: skipped,
      },
    };
  },
};

/**
 * Format history for display
 */
function formatHistory(messages: HistoryMessage[], skipped: number, total: number): string {
  const lines: string[] = [
    `Conversation History (${messages.length} of ${total} messages)`,
    '='.repeat(50),
    '',
  ];

  if (skipped > 0) {
    lines.push(`... ${skipped} earlier message(s) not shown ...`);
    lines.push('');
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const roleIcon = getRoleIcon(msg.role);
    const timestamp = formatTimestamp(msg.timestamp);
    const modelInfo = msg.model ? ` [${msg.model}]` : '';

    lines.push(`${roleIcon} ${msg.role.toUpperCase()}${modelInfo} - ${timestamp}`);
    lines.push('-'.repeat(40));

    // Truncate long messages
    const content = msg.content.length > 500
      ? msg.content.slice(0, 500) + '...'
      : msg.content;

    lines.push(content);
    lines.push('');
  }

  lines.push('Use /history --all to see all messages, or /history <count> for specific number.');

  return lines.join('\n');
}

/**
 * Get icon for message role
 */
function getRoleIcon(role: string): string {
  switch (role) {
    case 'user':
      return '[USER]';
    case 'assistant':
      return '[GROK]';
    case 'system':
      return '[SYS]';
    default:
      return '[???]';
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // If within the last hour, show relative time
  if (diff < 60000) {
    return 'just now';
  }
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // If today, show time only
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Otherwise show date and time
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default historyCommand;
```

---

### Step 9: Create Command Registry

Create `src/commands/index.ts`:

```typescript
/**
 * Command Registry
 *
 * Central registry for all slash commands.
 * Handles command registration, lookup, and dispatch.
 */

import type { Command, ParsedCommand, CommandContext, CommandResult } from './types.js';
import { parseInput, isCommand, parseCommand } from './parser.js';

// Import command handlers
import { helpCommand } from './handlers/help.js';
import { modelCommand } from './handlers/model.js';
import { clearCommand } from './handlers/clear.js';
import { exitCommand } from './handlers/exit.js';
import { historyCommand } from './handlers/history.js';

/**
 * Command Registry class
 */
class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Register a command
   */
  register(command: Command): void {
    // Register main command name
    this.commands.set(command.name.toLowerCase(), command);

    // Register aliases
    for (const alias of command.aliases) {
      this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
    }
  }

  /**
   * Get a command by name or alias
   */
  getCommand(nameOrAlias: string): Command | undefined {
    const normalized = nameOrAlias.toLowerCase();

    // Check direct command match
    if (this.commands.has(normalized)) {
      return this.commands.get(normalized);
    }

    // Check alias
    const aliasTarget = this.aliases.get(normalized);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }

    return undefined;
  }

  /**
   * Check if a command exists
   */
  hasCommand(nameOrAlias: string): boolean {
    return this.getCommand(nameOrAlias) !== undefined;
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Execute a parsed command
   */
  async execute(parsed: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const command = this.getCommand(parsed.name);

    if (!command) {
      return {
        success: false,
        error: `Unknown command: /${parsed.name}\n\nUse /help to see available commands.`,
      };
    }

    try {
      return await command.execute(parsed, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
      };
    }
  }

  /**
   * Process user input - either execute command or return message
   */
  async processInput(
    input: string,
    context: CommandContext
  ): Promise<{ type: 'command'; result: CommandResult } | { type: 'message'; content: string } | { type: 'empty' }> {
    const parsed = parseInput(input);

    if (parsed.type === 'empty') {
      return { type: 'empty' };
    }

    if (parsed.type === 'message') {
      return { type: 'message', content: parsed.content };
    }

    // It's a command
    const result = await this.execute(parsed.command, context);
    return { type: 'command', result };
  }
}

// Singleton registry instance
let registryInstance: CommandRegistry | null = null;

/**
 * Get or create the command registry singleton
 */
export function getRegistry(): CommandRegistry {
  if (!registryInstance) {
    registryInstance = new CommandRegistry();

    // Register all built-in commands
    registryInstance.register(helpCommand);
    registryInstance.register(modelCommand);
    registryInstance.register(clearCommand);
    registryInstance.register(exitCommand);
    registryInstance.register(historyCommand);
  }

  return registryInstance;
}

/**
 * Reset the registry (primarily for testing)
 */
export function resetRegistry(): void {
  registryInstance = null;
}

// Re-export types and utilities
export type { Command, CommandResult, ParsedCommand, CommandContext, HistoryMessage } from './types.js';
export { parseInput, isCommand, parseCommand } from './parser.js';

// Export individual commands for direct access
export { helpCommand } from './handlers/help.js';
export { modelCommand } from './handlers/model.js';
export { clearCommand } from './handlers/clear.js';
export { exitCommand } from './handlers/exit.js';
export { historyCommand } from './handlers/history.js';
```

---

### Step 10: Update UI App for Command Routing

Update `src/ui/app.tsx`:

```typescript
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Box, Text, useApp, useInput, Static } from 'ink';
import { GrokAgent, AgentEvent } from '../agent/grok-agent.js';
import { MessageDisplay } from './components/message.js';
import { ToolOutput } from './components/tool-output.js';
import { InputPrompt } from './components/input.js';
import { Spinner } from './components/spinner.js';
import { ConfirmDialog } from './components/confirm.js';
import { TodoDisplay } from './components/todo-display.js';
import { TodoTool } from '../tools/todo.js';
import { getRegistry, isCommand, CommandContext, HistoryMessage, CommandResult } from '../commands/index.js';
import { getDefaultModel, resolveModelId } from '../config/models.js';

interface AppProps {
  initialPrompt?: string;
  model?: string;
}

type AppState = 'idle' | 'running' | 'waiting_input' | 'confirming';

interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: Date;
  model?: string;
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

export function App({ initialPrompt, model: initialModel }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(initialPrompt ? 'running' : 'idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [toolOutputs, setToolOutputs] = useState<ToolOutputItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [currentModel, setCurrentModel] = useState(() =>
    initialModel ? resolveModelId(initialModel) : getDefaultModel()
  );
  const [commandOutput, setCommandOutput] = useState<string | null>(null);

  // Create agent with current model
  const agentRef = useRef<GrokAgent | null>(null);

  const getOrCreateAgent = useCallback(() => {
    if (!agentRef.current || agentRef.current.model !== currentModel) {
      agentRef.current = new GrokAgent({ model: currentModel });
    }
    return agentRef.current;
  }, [currentModel]);

  // Anti-flickering: Buffer for streaming text
  const textBufferRef = useRef('');
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingTextRef = useRef('');

  // Flush buffered text to state (batched updates prevent flickering)
  const flushBuffer = useCallback(() => {
    if (textBufferRef.current) {
      setStreamingText(prev => {
        const updated = prev + textBufferRef.current;
        streamingTextRef.current = updated;
        return updated;
      });
      textBufferRef.current = '';
    }
    flushTimerRef.current = null;
  }, []);

  // Add text to buffer with debounced flush (50ms batching)
  const appendText = useCallback((text: string) => {
    textBufferRef.current += text;
    streamingTextRef.current += text;
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

  // Create command context
  const createCommandContext = useCallback((): CommandContext => ({
    currentModel,
    setModel: (model: string) => {
      setCurrentModel(model);
      agentRef.current = null; // Force agent recreation with new model
    },
    getHistory: (): HistoryMessage[] => {
      return messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.timestamp,
        model: m.model,
      }));
    },
    clearHistory: () => {
      setMessages([]);
      setToolOutputs([]);
      setError(null);
      setCommandOutput(null);
    },
    exit: () => exit(),
    cwd: process.cwd(),
  }), [currentModel, messages, exit]);

  // Handle command execution
  const executeCommand = useCallback(async (input: string): Promise<boolean> => {
    const registry = getRegistry();
    const context = createCommandContext();
    const result = await registry.processInput(input, context);

    if (result.type === 'empty') {
      return true; // Handled (do nothing)
    }

    if (result.type === 'message') {
      return false; // Not a command, needs to be sent to agent
    }

    // It's a command result
    const commandResult = result.result;

    if (commandResult.output) {
      setCommandOutput(commandResult.output);
    }

    if (commandResult.error) {
      setError(commandResult.error);
    }

    // Handle special actions
    if (commandResult.action) {
      switch (commandResult.action.type) {
        case 'exit':
          setTimeout(() => exit(), 100);
          break;
        case 'clear':
          setMessages([]);
          setToolOutputs([]);
          setCommandOutput(null);
          break;
        case 'set_model':
          // Model already set via context.setModel
          break;
      }
    }

    return true; // Command was handled
  }, [createCommandContext, exit]);

  // Process agent events
  const runAgent = useCallback(async (prompt: string) => {
    setState('running');
    setStreamingText('');
    streamingTextRef.current = '';
    setError(null);
    setCommandOutput(null);
    textBufferRef.current = '';

    const agent = getOrCreateAgent();

    try {
      for await (const event of agent.run(prompt, handleConfirmation)) {
        switch (event.type) {
          case 'text':
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
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }

            const fullText = streamingTextRef.current + textBufferRef.current;
            textBufferRef.current = '';
            streamingTextRef.current = '';

            flushSync(() => {
              setStreamingText('');

              if (fullText) {
                setMessages(prev => [...prev, {
                  id: generateId(),
                  role: 'assistant',
                  content: fullText,
                  timestamp: new Date(),
                  model: currentModel,
                }]);
              }

              setState('idle');
            });
            break;
        }
      }
    } catch (err) {
      flushBuffer();
      setError(err instanceof Error ? err.message : 'Agent failed');
      setState('idle');
    }
  }, [getOrCreateAgent, handleConfirmation, appendText, flushBuffer, currentModel]);

  // Run initial prompt
  useEffect(() => {
    if (initialPrompt) {
      // Check if initial prompt is a command
      if (isCommand(initialPrompt)) {
        executeCommand(initialPrompt).then((handled) => {
          if (!handled) {
            setMessages([{ id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() }]);
            runAgent(initialPrompt);
          } else {
            setState('idle');
          }
        });
      } else {
        setMessages([{ id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() }]);
        runAgent(initialPrompt);
      }
    }
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  // Handle user input
  const handleSubmit = useCallback(async (value: string) => {
    // Clear previous command output
    setCommandOutput(null);
    setError(null);

    // Check for legacy exit commands (without slash)
    if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
      exit();
      return;
    }

    // Check if it's a command
    if (isCommand(value)) {
      const handled = await executeCommand(value);
      if (handled) {
        return; // Command was processed
      }
    }

    // It's a regular message - send to agent
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      content: value,
      timestamp: new Date(),
    }]);
    runAgent(value);
  }, [exit, executeCommand, runAgent]);

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

  // Memoized completed content
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

  const allCompletedItems = useMemo(() => {
    const items: Array<{ type: 'message' | 'tool'; id: string; data: any }> = [];

    completedMessages.forEach(msg => {
      items.push({ type: 'message', id: msg.id, data: msg });
    });

    completedTools.forEach(tool => {
      items.push({ type: 'tool', id: tool.id, data: tool });
    });

    return items;
  }, [completedMessages, completedTools]);

  const todos = TodoTool.getTodos();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>grok-cli</Text>
        <Text color="gray"> - Claude Code for xAI Grok</Text>
        <Text color="gray"> [{currentModel}]</Text>
      </Box>

      {/* Todo Display */}
      {todos.length > 0 && <TodoDisplay todos={todos} />}

      {/* Consolidated Static: All completed items */}
      <Static items={allCompletedItems}>
        {(item) => item.type === 'message' ? (
          <MessageDisplay key={item.id} role={item.data.role} content={item.data.content} />
        ) : (
          <ToolOutput key={item.id} toolName={item.data.tool} result={item.data.result} />
        )}
      </Static>

      {/* Dynamic: Pending tool outputs */}
      {pendingTools.map((t) => (
        <ToolOutput key={t.id} toolName={t.tool} result={t.result} />
      ))}

      {/* Streaming text */}
      {streamingText && (
        <Box marginY={1}>
          <Text color="green">{streamingText}</Text>
        </Box>
      )}

      {/* Command output */}
      {commandOutput && (
        <Box marginY={1} flexDirection="column">
          <Text color="cyan">{commandOutput}</Text>
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

---

### Step 11: Update CLI Entry Point

Update `src/index.tsx`:

```typescript
#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { App } from './ui/app.js';
import { getModel, getDefaultModel, getModelIds, GROK_MODELS } from './config/models.js';

// Parse CLI arguments
const args = process.argv.slice(2);

// Handle --help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
grok-cli - Claude Code for xAI Grok

USAGE:
  grok [options] [prompt]

OPTIONS:
  --model, -m <model>   Set the model to use (default: ${getDefaultModel()})
  --list-models         List all available models
  --version, -v         Show version
  --help, -h            Show this help message

MODELS:
${getModelIds().map(id => {
  const m = GROK_MODELS[id];
  const defaultStr = m.isDefault ? ' (default)' : '';
  return `  ${id.padEnd(25)} ${m.displayName}${defaultStr}`;
}).join('\n')}

EXAMPLES:
  grok                           Start interactive mode
  grok "Hello, what can you do?" Send a prompt directly
  grok --model grok-3-beta       Start with a specific model
  grok -m grok4 "Complex task"   Use model alias with prompt

COMMANDS (in interactive mode):
  /help                 Show available commands
  /model [name]         Show or switch model
  /clear                Clear conversation
  /history [count]      Show conversation history
  /exit                 Exit the CLI

ENVIRONMENT:
  GROK_API_KEY          xAI API key (required)
  XAI_API_KEY           Alternative API key env var
  GROK_LOG_LEVEL        Log level (debug, info, warn, error)

For more information, visit: https://github.com/airplne/grok-cli
`);
  process.exit(0);
}

// Handle --version flag
if (args.includes('--version') || args.includes('-v')) {
  console.log('grok-cli version 1.0.0');
  process.exit(0);
}

// Handle --list-models flag
if (args.includes('--list-models')) {
  console.log('\nAvailable Models:');
  console.log('=================\n');

  for (const [id, model] of Object.entries(GROK_MODELS)) {
    const defaultStr = model.isDefault ? ' (default)' : '';
    const contextStr = model.contextWindow >= 1000000
      ? `${(model.contextWindow / 1000000).toFixed(0)}M`
      : `${(model.contextWindow / 1000).toFixed(0)}K`;

    console.log(`${model.displayName}${defaultStr}`);
    console.log(`  ID: ${id}`);
    console.log(`  ${model.description}`);
    console.log(`  Context: ${contextStr} tokens`);
    console.log(`  Pricing: $${model.inputPrice.toFixed(2)}/$${model.outputPrice.toFixed(2)} per 1M tokens (in/out)`);
    console.log('');
  }

  process.exit(0);
}

// Parse --model flag
let model: string | undefined;
const modelFlagIndex = args.findIndex(a => a === '--model' || a === '-m');
if (modelFlagIndex !== -1 && args[modelFlagIndex + 1]) {
  const requestedModel = args[modelFlagIndex + 1];
  const modelConfig = getModel(requestedModel);

  if (!modelConfig) {
    console.error(`Error: Unknown model "${requestedModel}"`);
    console.error(`\nAvailable models: ${getModelIds().join(', ')}`);
    console.error('\nUse --list-models for details.');
    process.exit(1);
  }

  model = modelConfig.id;
  // Remove model flag and value from args
  args.splice(modelFlagIndex, 2);
}

// Extract prompt (remaining non-flag arguments)
const prompt = args
  .filter(a => !a.startsWith('-'))
  .join(' ')
  .trim() || undefined;

// Check for API key
if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) {
  console.error('Error: Missing API key.');
  console.error('\nSet GROK_API_KEY or XAI_API_KEY environment variable:');
  console.error('  export GROK_API_KEY="xai-your-key-here"');
  console.error('\nGet your API key from: https://console.x.ai/');
  process.exit(1);
}

// Render the app
render(<App initialPrompt={prompt} model={model} />);
```

---

### Step 12: Update GrokAgent to Expose Model

Add a model property to `src/agent/grok-agent.ts`. Add this getter after the constructor:

```typescript
// Add this getter to the GrokAgent class (after line 34)
get model(): string {
  return this.client.model;
}
```

---

## Directory Creation Commands

Run these commands to create the required directories:

```bash
mkdir -p /home/aip0rt/Desktop/grok-cli/src/commands/handlers
```

---

## Verification Checklist

After implementing Phase 1, verify each item:

### Command Infrastructure
- [ ] `src/commands/types.ts` exists with all interfaces
- [ ] `src/commands/parser.ts` exists and parses commands correctly
- [ ] `src/commands/index.ts` exists with registry
- [ ] `src/config/models.ts` exists with all 5 models

### Command Handlers
- [ ] `/help` displays all commands
- [ ] `/help model` displays model command details
- [ ] `/model` shows current model
- [ ] `/model grok-3-beta` switches model
- [ ] `/model --list` lists all models
- [ ] `/clear` clears history
- [ ] `/exit` exits the CLI
- [ ] `/history` shows conversation history
- [ ] `/history 5` shows last 5 messages

### CLI Flags
- [ ] `grok --help` shows help
- [ ] `grok --version` shows version
- [ ] `grok --list-models` lists models
- [ ] `grok --model grok-3-beta "hello"` uses specified model
- [ ] `grok -m grok4 "hello"` uses model alias

### Parser Tests
- [ ] Run `npx tsx src/commands/parser.ts` - all tests pass

### Integration
- [ ] Regular messages still work
- [ ] Commands starting with `/` are intercepted
- [ ] Non-commands starting with `/` (like `//comment`) are not intercepted
- [ ] Model changes persist across messages

---

## Success Criteria

Phase 1 is complete when:

1. **All 5 commands work** - `/help`, `/model`, `/clear`, `/exit`, `/history`
2. **Parser handles all cases** - basic commands, arguments, flags, quoted strings
3. **Model switching works** - `/model grok-3-beta` changes the model for subsequent messages
4. **CLI flags work** - `--help`, `--version`, `--list-models`, `--model`
5. **No regressions** - existing agent functionality still works
6. **All tests pass** - parser tests run successfully

---

## Notes for Implementation

1. **Create directories first** - Run the mkdir command before creating files
2. **Build incrementally** - Create types first, then parser, then handlers
3. **Test the parser** - Run parser tests after creating parser.ts
4. **Test each command** - Verify each handler works before moving on
5. **Keep existing functionality** - Don't break the agent loop

---

*Generated by Claude Opus 4.5*
