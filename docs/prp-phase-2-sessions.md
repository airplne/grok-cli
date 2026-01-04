# PRP: Phase 2 - Session Management System

**Created**: 2026-01-03
**Author**: Claude Opus 4.5
**Status**: Ready for Execution
**Estimated Effort**: 6-8 hours
**Prerequisites**: Phase 1 (Core Agent MVP) complete

---

## Executive Summary

Implement a complete session management system for grok-cli that enables conversation persistence, resumption, and export. This includes session storage, session manager, CLI commands (`/session`, `/resume`, `/rename`, `/export`), and CLI flags (`--resume`, `--session`).

---

## Goals

1. **Session Persistence**: Save conversation history to disk automatically
2. **Session Resumption**: Continue previous sessions with `--resume` or `--session <id>`
3. **Session Management**: List, rename, and delete sessions via slash commands
4. **Session Export**: Export sessions to various formats (JSON, Markdown)
5. **Dual Storage**: Support both project-local (`.grok/`) and global (`~/.grok/`) sessions

---

## Architecture Overview

```
src/
├── session/
│   ├── types.ts          # Session interface and types
│   ├── manager.ts        # SessionManager class (high-level operations)
│   └── storage.ts        # SessionStorage class (file persistence)
├── commands/
│   ├── types.ts          # Command interfaces
│   ├── registry.ts       # Command registration
│   └── handlers/
│       └── session/
│           ├── session.ts   # /session command (list, delete, info)
│           ├── resume.ts    # /resume command
│           ├── rename.ts    # /rename command
│           └── export.ts    # /export command
├── index.tsx             # Updated with --resume, --session flags
└── ui/
    └── app.tsx           # Updated with session state integration
```

---

## Implementation

### File 1: `src/session/types.ts`

**Purpose**: Define all session-related TypeScript interfaces and types.

```typescript
import OpenAI from 'openai';

/**
 * Represents a single message in the conversation history.
 * Compatible with OpenAI's ChatCompletionMessageParam type.
 */
export type SessionMessage = OpenAI.Chat.ChatCompletionMessageParam;

/**
 * Session metadata for display and organization purposes.
 */
export interface SessionMetadata {
  /** Human-readable name for the session (optional, defaults to first prompt) */
  name?: string;
  /** Initial prompt that started the session */
  firstPrompt?: string;
  /** Working directory when session was created */
  cwd: string;
  /** Model used for this session */
  model: string;
  /** Total number of messages in the session */
  messageCount: number;
  /** Total tokens used (if tracked) */
  totalTokens?: number;
  /** Custom tags for organization */
  tags?: string[];
}

/**
 * Complete session object stored on disk.
 */
export interface Session {
  /** Unique session identifier (8-character hex) */
  id: string;
  /** ISO timestamp of session creation */
  createdAt: string;
  /** ISO timestamp of last modification */
  updatedAt: string;
  /** Version number for format migrations */
  version: number;
  /** Session metadata */
  metadata: SessionMetadata;
  /** Complete message history */
  messages: SessionMessage[];
}

/**
 * Summary view of a session for listing.
 */
export interface SessionSummary {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  firstPrompt?: string;
}

/**
 * Session storage location options.
 */
export type StorageLocation = 'local' | 'global';

/**
 * Export format options.
 */
export type ExportFormat = 'json' | 'markdown' | 'text';

/**
 * Session storage configuration.
 */
export interface SessionStorageConfig {
  /** Use global (~/.grok/) or local (.grok/) storage */
  location: StorageLocation;
  /** Custom base directory (overrides location) */
  baseDir?: string;
}

/**
 * Options for session listing.
 */
export interface ListSessionsOptions {
  /** Maximum number of sessions to return */
  limit?: number;
  /** Filter by tag */
  tag?: string;
  /** Sort order */
  sortBy?: 'created' | 'updated' | 'name';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Current session storage format version.
 * Increment when making breaking changes to Session interface.
 */
export const SESSION_VERSION = 1;

/**
 * Default session storage paths.
 */
export const SESSION_PATHS = {
  local: '.grok/sessions',
  global: '.grok/sessions',  // Relative to HOME
} as const;
```

---

### File 2: `src/session/storage.ts`

**Purpose**: Low-level file operations for session persistence.

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Session,
  SessionSummary,
  SessionStorageConfig,
  StorageLocation,
  SESSION_PATHS,
  SESSION_VERSION,
} from './types.js';

/**
 * Handles low-level session file operations.
 * Provides CRUD operations for session JSON files.
 */
export class SessionStorage {
  private baseDir: string;
  private location: StorageLocation;

  constructor(config: SessionStorageConfig = { location: 'local' }) {
    this.location = config.location;

    if (config.baseDir) {
      this.baseDir = config.baseDir;
    } else if (config.location === 'global') {
      this.baseDir = path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        SESSION_PATHS.global
      );
    } else {
      this.baseDir = path.join(process.cwd(), SESSION_PATHS.local);
    }
  }

  /**
   * Ensure the sessions directory exists.
   */
  async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Get the file path for a session ID.
   */
  private getFilePath(sessionId: string): string {
    // Sanitize session ID to prevent path traversal
    const safeId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
    return path.join(this.baseDir, `${safeId}.json`);
  }

  /**
   * Generate a unique session ID.
   * Format: 8-character hex string (e.g., "a1b2c3d4")
   */
  static generateId(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  /**
   * Save a session to disk.
   * Creates the file if it doesn't exist, overwrites if it does.
   */
  async save(session: Session): Promise<void> {
    await this.ensureDir();

    // Update modification timestamp
    const updatedSession: Session = {
      ...session,
      updatedAt: new Date().toISOString(),
      version: SESSION_VERSION,
    };

    const filePath = this.getFilePath(session.id);
    const content = JSON.stringify(updatedSession, null, 2);

    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Load a session by ID.
   * Returns null if session doesn't exist.
   */
  async load(sessionId: string): Promise<Session | null> {
    const filePath = this.getFilePath(sessionId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content) as Session;

      // Validate basic structure
      if (!session.id || !session.messages || !Array.isArray(session.messages)) {
        console.error(`Invalid session format: ${sessionId}`);
        return null;
      }

      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if a session exists.
   */
  async exists(sessionId: string): Promise<boolean> {
    const filePath = this.getFilePath(sessionId);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a session by ID.
   * Returns true if deleted, false if not found.
   */
  async delete(sessionId: string): Promise<boolean> {
    const filePath = this.getFilePath(sessionId);

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all session IDs in storage.
   */
  async listIds(): Promise<string[]> {
    try {
      await this.ensureDir();
      const files = await fs.readdir(this.baseDir);

      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * List all sessions with summary information.
   * Sorted by modification time (most recent first).
   */
  async listSummaries(): Promise<SessionSummary[]> {
    const ids = await this.listIds();
    const summaries: SessionSummary[] = [];

    for (const id of ids) {
      try {
        const session = await this.load(id);
        if (session) {
          summaries.push({
            id: session.id,
            name: session.metadata.name,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages.length,
            firstPrompt: session.metadata.firstPrompt,
          });
        }
      } catch {
        // Skip corrupted sessions
        console.error(`Skipping corrupted session: ${id}`);
      }
    }

    // Sort by updatedAt descending (most recent first)
    summaries.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return summaries;
  }

  /**
   * Get the most recently updated session.
   */
  async getLatest(): Promise<Session | null> {
    const summaries = await this.listSummaries();

    if (summaries.length === 0) {
      return null;
    }

    return this.load(summaries[0].id);
  }

  /**
   * Clear all sessions from storage.
   * USE WITH CAUTION.
   */
  async clearAll(): Promise<number> {
    const ids = await this.listIds();
    let deleted = 0;

    for (const id of ids) {
      const success = await this.delete(id);
      if (success) deleted++;
    }

    return deleted;
  }

  /**
   * Get storage statistics.
   */
  async getStats(): Promise<{ count: number; totalSize: number }> {
    const ids = await this.listIds();
    let totalSize = 0;

    for (const id of ids) {
      try {
        const filePath = this.getFilePath(id);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch {
        // Skip if file no longer exists
      }
    }

    return { count: ids.length, totalSize };
  }

  /**
   * Get the base directory path.
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Get the storage location type.
   */
  getLocation(): StorageLocation {
    return this.location;
  }
}
```

---

### File 3: `src/session/manager.ts`

**Purpose**: High-level session management operations.

```typescript
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import {
  Session,
  SessionMessage,
  SessionMetadata,
  SessionSummary,
  StorageLocation,
  ExportFormat,
  ListSessionsOptions,
  SESSION_VERSION,
} from './types.js';
import { SessionStorage } from './storage.js';

/**
 * Options for creating a new session.
 */
export interface CreateSessionOptions {
  /** Human-readable name for the session */
  name?: string;
  /** Model to use */
  model?: string;
  /** Initial messages */
  messages?: SessionMessage[];
  /** Working directory */
  cwd?: string;
  /** Tags for organization */
  tags?: string[];
}

/**
 * Options for the SessionManager.
 */
export interface SessionManagerOptions {
  /** Storage location */
  location?: StorageLocation;
  /** Auto-save after each message */
  autoSave?: boolean;
  /** Custom storage directory */
  storageDir?: string;
}

/**
 * High-level session management.
 * Handles session lifecycle, auto-save, and export functionality.
 */
export class SessionManager {
  private storage: SessionStorage;
  private currentSession: Session | null = null;
  private autoSave: boolean;

  constructor(options: SessionManagerOptions = {}) {
    this.storage = new SessionStorage({
      location: options.location || 'local',
      baseDir: options.storageDir,
    });
    this.autoSave = options.autoSave ?? true;
  }

  /**
   * Create a new session.
   */
  async create(options: CreateSessionOptions = {}): Promise<Session> {
    const now = new Date().toISOString();
    const id = SessionStorage.generateId();

    // Extract first prompt from initial messages if available
    let firstPrompt: string | undefined;
    if (options.messages && options.messages.length > 0) {
      const firstUserMsg = options.messages.find(m => m.role === 'user');
      if (firstUserMsg && 'content' in firstUserMsg) {
        const content = firstUserMsg.content;
        if (typeof content === 'string') {
          firstPrompt = content.slice(0, 100);
        }
      }
    }

    const session: Session = {
      id,
      createdAt: now,
      updatedAt: now,
      version: SESSION_VERSION,
      metadata: {
        name: options.name,
        firstPrompt,
        cwd: options.cwd || process.cwd(),
        model: options.model || 'grok-4-1-fast',
        messageCount: options.messages?.length || 0,
        tags: options.tags,
      },
      messages: options.messages || [],
    };

    await this.storage.save(session);
    this.currentSession = session;

    return session;
  }

  /**
   * Load an existing session by ID.
   */
  async load(sessionId: string): Promise<Session | null> {
    const session = await this.storage.load(sessionId);

    if (session) {
      this.currentSession = session;
    }

    return session;
  }

  /**
   * Load the most recent session.
   */
  async loadLatest(): Promise<Session | null> {
    const session = await this.storage.getLatest();

    if (session) {
      this.currentSession = session;
    }

    return session;
  }

  /**
   * Get the current active session.
   */
  getCurrent(): Session | null {
    return this.currentSession;
  }

  /**
   * Set the current session (used when resuming).
   */
  setCurrent(session: Session): void {
    this.currentSession = session;
  }

  /**
   * Add a message to the current session.
   */
  async addMessage(message: SessionMessage): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Create or load a session first.');
    }

    this.currentSession.messages.push(message);
    this.currentSession.metadata.messageCount = this.currentSession.messages.length;
    this.currentSession.updatedAt = new Date().toISOString();

    // Extract first prompt if not set
    if (!this.currentSession.metadata.firstPrompt && message.role === 'user') {
      const content = 'content' in message ? message.content : '';
      if (typeof content === 'string') {
        this.currentSession.metadata.firstPrompt = content.slice(0, 100);
      }
    }

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Add multiple messages to the current session.
   */
  async addMessages(messages: SessionMessage[]): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Create or load a session first.');
    }

    for (const message of messages) {
      this.currentSession.messages.push(message);
    }

    this.currentSession.metadata.messageCount = this.currentSession.messages.length;
    this.currentSession.updatedAt = new Date().toISOString();

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Update the messages in the current session (replace all).
   */
  async updateMessages(messages: SessionMessage[]): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Create or load a session first.');
    }

    this.currentSession.messages = messages;
    this.currentSession.metadata.messageCount = messages.length;
    this.currentSession.updatedAt = new Date().toISOString();

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Save the current session to storage.
   */
  async save(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to save.');
    }

    await this.storage.save(this.currentSession);
  }

  /**
   * Rename the current session.
   */
  async rename(newName: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to rename.');
    }

    this.currentSession.metadata.name = newName;
    this.currentSession.updatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * Rename a session by ID.
   */
  async renameById(sessionId: string, newName: string): Promise<boolean> {
    const session = await this.storage.load(sessionId);

    if (!session) {
      return false;
    }

    session.metadata.name = newName;
    session.updatedAt = new Date().toISOString();

    await this.storage.save(session);

    // Update current session if it's the same one
    if (this.currentSession?.id === sessionId) {
      this.currentSession = session;
    }

    return true;
  }

  /**
   * Delete a session by ID.
   */
  async delete(sessionId: string): Promise<boolean> {
    const deleted = await this.storage.delete(sessionId);

    // Clear current session if it was deleted
    if (deleted && this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }

    return deleted;
  }

  /**
   * List all sessions.
   */
  async list(options: ListSessionsOptions = {}): Promise<SessionSummary[]> {
    let summaries = await this.storage.listSummaries();

    // Apply tag filter
    if (options.tag) {
      // Would need to load full sessions for tag filtering
      // For now, skip tag filtering in summaries
    }

    // Apply sorting
    if (options.sortBy) {
      summaries.sort((a, b) => {
        let comparison = 0;

        switch (options.sortBy) {
          case 'name':
            comparison = (a.name || '').localeCompare(b.name || '');
            break;
          case 'created':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'updated':
          default:
            comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
        }

        return options.sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      summaries = summaries.slice(0, options.limit);
    }

    return summaries;
  }

  /**
   * Export a session to a specified format.
   */
  async export(
    sessionId: string,
    format: ExportFormat,
    outputPath?: string
  ): Promise<string> {
    const session = await this.storage.load(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(session, null, 2);
        break;

      case 'markdown':
        content = this.formatAsMarkdown(session);
        break;

      case 'text':
        content = this.formatAsText(session);
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Write to file if output path specified
    if (outputPath) {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content, 'utf-8');
    }

    return content;
  }

  /**
   * Export the current session.
   */
  async exportCurrent(format: ExportFormat, outputPath?: string): Promise<string> {
    if (!this.currentSession) {
      throw new Error('No active session to export.');
    }

    return this.export(this.currentSession.id, format, outputPath);
  }

  /**
   * Format session as Markdown.
   */
  private formatAsMarkdown(session: Session): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Session: ${session.metadata.name || session.id}`);
    lines.push('');
    lines.push(`- **ID**: ${session.id}`);
    lines.push(`- **Created**: ${session.createdAt}`);
    lines.push(`- **Updated**: ${session.updatedAt}`);
    lines.push(`- **Model**: ${session.metadata.model}`);
    lines.push(`- **Messages**: ${session.metadata.messageCount}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    for (const message of session.messages) {
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      lines.push(`## ${role}`);
      lines.push('');

      if ('content' in message && message.content) {
        if (typeof message.content === 'string') {
          lines.push(message.content);
        } else if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if ('text' in part) {
              lines.push(part.text);
            }
          }
        }
      }

      // Handle tool calls
      if ('tool_calls' in message && message.tool_calls) {
        lines.push('');
        lines.push('### Tool Calls');
        for (const call of message.tool_calls) {
          lines.push(`- **${call.function.name}**: \`${call.function.arguments}\``);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format session as plain text.
   */
  private formatAsText(session: Session): string {
    const lines: string[] = [];

    lines.push(`Session: ${session.metadata.name || session.id}`);
    lines.push(`Created: ${session.createdAt}`);
    lines.push(`Model: ${session.metadata.model}`);
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('');

    for (const message of session.messages) {
      const role = message.role.toUpperCase();
      lines.push(`[${role}]`);

      if ('content' in message && message.content) {
        if (typeof message.content === 'string') {
          lines.push(message.content);
        }
      }

      lines.push('');
      lines.push('-'.repeat(40));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Clear all sessions from storage.
   */
  async clearAll(): Promise<number> {
    const deleted = await this.storage.clearAll();
    this.currentSession = null;
    return deleted;
  }

  /**
   * Get storage statistics.
   */
  async getStats(): Promise<{ count: number; totalSize: number; location: string }> {
    const stats = await this.storage.getStats();
    return {
      ...stats,
      location: this.storage.getBaseDir(),
    };
  }

  /**
   * Get the storage instance (for advanced operations).
   */
  getStorage(): SessionStorage {
    return this.storage;
  }
}
```

---

### File 4: `src/commands/types.ts`

**Purpose**: Define command system interfaces.

```typescript
/**
 * Result of executing a slash command.
 */
export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Message to display to the user */
  message?: string;
  /** Detailed output (for verbose commands) */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Whether to continue the agent loop or stop */
  continueLoop?: boolean;
  /** Data payload for UI updates */
  data?: Record<string, unknown>;
}

/**
 * Context provided to command handlers.
 */
export interface CommandContext {
  /** Session manager instance */
  sessionManager: import('../session/manager.js').SessionManager;
  /** Current working directory */
  cwd: string;
  /** Current model */
  model: string;
  /** Exit the application */
  exit: () => void;
}

/**
 * Handler function for a slash command.
 */
export type CommandHandler = (
  args: string[],
  context: CommandContext
) => Promise<CommandResult>;

/**
 * Definition of a slash command.
 */
export interface CommandDefinition {
  /** Command name (without leading slash) */
  name: string;
  /** Aliases for the command */
  aliases?: string[];
  /** Brief description */
  description: string;
  /** Detailed usage information */
  usage: string;
  /** Command handler function */
  handler: CommandHandler;
}

/**
 * Check if input is a slash command.
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Parse a slash command into name and arguments.
 */
export function parseSlashCommand(input: string): { name: string; args: string[] } {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    throw new Error('Not a slash command');
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const name = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  return { name, args };
}
```

---

### File 5: `src/commands/registry.ts`

**Purpose**: Command registration and lookup.

```typescript
import { CommandDefinition, CommandHandler, CommandResult, CommandContext } from './types.js';
import { sessionHandler } from './handlers/session/session.js';
import { resumeHandler } from './handlers/session/resume.js';
import { renameHandler } from './handlers/session/rename.js';
import { exportHandler } from './handlers/session/export.js';

/**
 * Registry of all available slash commands.
 */
class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Register a command.
   */
  register(definition: CommandDefinition): void {
    this.commands.set(definition.name, definition);

    // Register aliases
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.aliases.set(alias, definition.name);
      }
    }
  }

  /**
   * Get a command by name or alias.
   */
  get(nameOrAlias: string): CommandDefinition | undefined {
    const name = this.aliases.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(name);
  }

  /**
   * Check if a command exists.
   */
  has(nameOrAlias: string): boolean {
    return this.commands.has(nameOrAlias) || this.aliases.has(nameOrAlias);
  }

  /**
   * Get all registered commands.
   */
  getAll(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Execute a command by name.
   */
  async execute(
    nameOrAlias: string,
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    const definition = this.get(nameOrAlias);

    if (!definition) {
      return {
        success: false,
        error: `Unknown command: /${nameOrAlias}. Type /help for available commands.`,
      };
    }

    try {
      return await definition.handler(args, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
      };
    }
  }
}

// Create singleton instance
export const commandRegistry = new CommandRegistry();

// Register session commands
commandRegistry.register({
  name: 'session',
  aliases: ['sessions', 's'],
  description: 'Manage sessions (list, info, delete)',
  usage: '/session [list|info <id>|delete <id>|clear]',
  handler: sessionHandler,
});

commandRegistry.register({
  name: 'resume',
  aliases: ['r'],
  description: 'Resume a previous session',
  usage: '/resume [session-id]',
  handler: resumeHandler,
});

commandRegistry.register({
  name: 'rename',
  aliases: [],
  description: 'Rename the current or specified session',
  usage: '/rename <new-name> [session-id]',
  handler: renameHandler,
});

commandRegistry.register({
  name: 'export',
  aliases: ['e'],
  description: 'Export a session to file',
  usage: '/export [session-id] [--format json|markdown|text] [--output path]',
  handler: exportHandler,
});

// Register help command
commandRegistry.register({
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands',
  usage: '/help [command]',
  handler: async (args, context) => {
    if (args.length > 0) {
      const cmd = commandRegistry.get(args[0]);
      if (cmd) {
        return {
          success: true,
          message: `/${cmd.name}: ${cmd.description}\nUsage: ${cmd.usage}`,
        };
      }
      return {
        success: false,
        error: `Unknown command: ${args[0]}`,
      };
    }

    const commands = commandRegistry.getAll();
    const lines = commands.map(cmd => `  /${cmd.name} - ${cmd.description}`);

    return {
      success: true,
      message: 'Available commands:\n' + lines.join('\n') + '\n\nType /help <command> for details.',
    };
  },
});

// Register exit command
commandRegistry.register({
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit the application',
  usage: '/exit',
  handler: async (args, context) => {
    context.exit();
    return { success: true, message: 'Goodbye!' };
  },
});
```

---

### File 6: `src/commands/handlers/session/session.ts`

**Purpose**: Handle `/session` command for listing, info, and delete operations.

```typescript
import { CommandResult, CommandContext } from '../../types.js';

/**
 * Handler for /session command.
 *
 * Subcommands:
 *   - list (default): List all sessions
 *   - info <id>: Show detailed info about a session
 *   - delete <id>: Delete a session
 *   - clear: Delete all sessions
 */
export async function sessionHandler(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const { sessionManager } = context;
  const subcommand = args[0]?.toLowerCase() || 'list';

  switch (subcommand) {
    case 'list':
    case 'ls': {
      const sessions = await sessionManager.list({ limit: 20 });

      if (sessions.length === 0) {
        return {
          success: true,
          message: 'No sessions found.',
        };
      }

      const lines = sessions.map((s, i) => {
        const name = s.name || s.firstPrompt?.slice(0, 40) || 'Unnamed';
        const date = new Date(s.updatedAt).toLocaleDateString();
        const current = sessionManager.getCurrent()?.id === s.id ? ' (current)' : '';
        return `  ${i + 1}. [${s.id}] ${name} - ${s.messageCount} msgs - ${date}${current}`;
      });

      return {
        success: true,
        message: `Sessions (${sessions.length}):\n${lines.join('\n')}`,
      };
    }

    case 'info':
    case 'show': {
      const sessionId = args[1];

      if (!sessionId) {
        // Show current session info
        const current = sessionManager.getCurrent();
        if (!current) {
          return {
            success: false,
            error: 'No active session. Provide a session ID or start a new session.',
          };
        }

        return {
          success: true,
          message: formatSessionInfo(current),
        };
      }

      const session = await sessionManager.load(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`,
        };
      }

      return {
        success: true,
        message: formatSessionInfo(session),
      };
    }

    case 'delete':
    case 'rm': {
      const sessionId = args[1];

      if (!sessionId) {
        return {
          success: false,
          error: 'Please provide a session ID to delete. Usage: /session delete <id>',
        };
      }

      const deleted = await sessionManager.delete(sessionId);

      if (!deleted) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`,
        };
      }

      return {
        success: true,
        message: `Session ${sessionId} deleted.`,
      };
    }

    case 'clear': {
      // Require confirmation
      const confirm = args[1]?.toLowerCase();

      if (confirm !== '--yes' && confirm !== '-y') {
        return {
          success: false,
          error: 'This will delete ALL sessions. To confirm, use: /session clear --yes',
        };
      }

      const count = await sessionManager.clearAll();

      return {
        success: true,
        message: `Cleared ${count} session(s).`,
      };
    }

    case 'stats': {
      const stats = await sessionManager.getStats();
      const sizeKb = (stats.totalSize / 1024).toFixed(2);

      return {
        success: true,
        message: `Session Statistics:\n  - Total sessions: ${stats.count}\n  - Storage size: ${sizeKb} KB\n  - Location: ${stats.location}`,
      };
    }

    default:
      return {
        success: false,
        error: `Unknown subcommand: ${subcommand}. Available: list, info, delete, clear, stats`,
      };
  }
}

/**
 * Format session info for display.
 */
function formatSessionInfo(session: import('../../../session/types.js').Session): string {
  const lines = [
    `Session: ${session.metadata.name || 'Unnamed'}`,
    `  ID: ${session.id}`,
    `  Created: ${session.createdAt}`,
    `  Updated: ${session.updatedAt}`,
    `  Model: ${session.metadata.model}`,
    `  Messages: ${session.metadata.messageCount}`,
    `  Working Dir: ${session.metadata.cwd}`,
  ];

  if (session.metadata.tags?.length) {
    lines.push(`  Tags: ${session.metadata.tags.join(', ')}`);
  }

  if (session.metadata.firstPrompt) {
    lines.push(`  First Prompt: "${session.metadata.firstPrompt.slice(0, 50)}..."`);
  }

  return lines.join('\n');
}
```

---

### File 7: `src/commands/handlers/session/resume.ts`

**Purpose**: Handle `/resume` command to continue a previous session.

```typescript
import { CommandResult, CommandContext } from '../../types.js';

/**
 * Handler for /resume command.
 *
 * Usage:
 *   /resume         - Resume the most recent session
 *   /resume <id>    - Resume a specific session by ID
 *   /resume -l      - List recent sessions and resume interactively
 */
export async function resumeHandler(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const { sessionManager } = context;
  const sessionId = args[0];

  // Check for list flag
  if (sessionId === '-l' || sessionId === '--list') {
    const sessions = await sessionManager.list({ limit: 10 });

    if (sessions.length === 0) {
      return {
        success: false,
        error: 'No sessions available to resume.',
      };
    }

    const lines = sessions.map((s, i) => {
      const name = s.name || s.firstPrompt?.slice(0, 40) || 'Unnamed';
      const date = new Date(s.updatedAt).toLocaleDateString();
      return `  ${i + 1}. [${s.id}] ${name} - ${date}`;
    });

    return {
      success: true,
      message: `Recent sessions:\n${lines.join('\n')}\n\nUse /resume <id> to resume a session.`,
    };
  }

  let session;

  if (sessionId) {
    // Resume specific session
    session = await sessionManager.load(sessionId);

    if (!session) {
      // Try to find by partial ID match
      const sessions = await sessionManager.list();
      const match = sessions.find(s => s.id.startsWith(sessionId));

      if (match) {
        session = await sessionManager.load(match.id);
      }
    }

    if (!session) {
      return {
        success: false,
        error: `Session not found: ${sessionId}. Use /session list to see available sessions.`,
      };
    }
  } else {
    // Resume most recent session
    session = await sessionManager.loadLatest();

    if (!session) {
      return {
        success: false,
        error: 'No sessions available to resume. Start a new conversation first.',
      };
    }
  }

  // Set as current session
  sessionManager.setCurrent(session);

  const name = session.metadata.name || session.id;
  const messageCount = session.messages.length;

  // Get last few messages for context
  const recentMessages = session.messages.slice(-3);
  let preview = '';

  for (const msg of recentMessages) {
    if ('content' in msg && typeof msg.content === 'string') {
      const role = msg.role === 'user' ? 'You' : 'Grok';
      const content = msg.content.slice(0, 80);
      preview += `  ${role}: ${content}${msg.content.length > 80 ? '...' : ''}\n`;
    }
  }

  return {
    success: true,
    message: `Resumed session: ${name}\n  ID: ${session.id}\n  Messages: ${messageCount}\n\nRecent context:\n${preview}`,
    data: {
      sessionId: session.id,
      messages: session.messages,
    },
    continueLoop: true,
  };
}
```

---

### File 8: `src/commands/handlers/session/rename.ts`

**Purpose**: Handle `/rename` command to rename sessions.

```typescript
import { CommandResult, CommandContext } from '../../types.js';

/**
 * Handler for /rename command.
 *
 * Usage:
 *   /rename <new-name>           - Rename current session
 *   /rename <new-name> <id>      - Rename specific session by ID
 */
export async function renameHandler(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const { sessionManager } = context;

  if (args.length === 0) {
    return {
      success: false,
      error: 'Please provide a new name. Usage: /rename <new-name> [session-id]',
    };
  }

  const newName = args[0];
  const sessionId = args[1];

  // Validate name
  if (newName.length < 1) {
    return {
      success: false,
      error: 'Session name cannot be empty.',
    };
  }

  if (newName.length > 100) {
    return {
      success: false,
      error: 'Session name is too long (max 100 characters).',
    };
  }

  if (sessionId) {
    // Rename specific session
    const success = await sessionManager.renameById(sessionId, newName);

    if (!success) {
      return {
        success: false,
        error: `Session not found: ${sessionId}`,
      };
    }

    return {
      success: true,
      message: `Session ${sessionId} renamed to "${newName}".`,
    };
  } else {
    // Rename current session
    const current = sessionManager.getCurrent();

    if (!current) {
      return {
        success: false,
        error: 'No active session. Provide a session ID or start a new session.',
      };
    }

    await sessionManager.rename(newName);

    return {
      success: true,
      message: `Current session renamed to "${newName}".`,
    };
  }
}
```

---

### File 9: `src/commands/handlers/session/export.ts`

**Purpose**: Handle `/export` command to export sessions to files.

```typescript
import path from 'path';
import { CommandResult, CommandContext } from '../../types.js';
import { ExportFormat } from '../../../session/types.js';

/**
 * Handler for /export command.
 *
 * Usage:
 *   /export                              - Export current session as JSON to stdout
 *   /export <id>                         - Export specific session
 *   /export --format markdown            - Export as markdown
 *   /export --output ./session.json      - Export to file
 *   /export <id> -f md -o ./session.md   - Combined options
 */
export async function exportHandler(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const { sessionManager, cwd } = context;

  // Parse arguments
  let sessionId: string | undefined;
  let format: ExportFormat = 'json';
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--format' || arg === '-f') {
      const fmt = args[++i]?.toLowerCase();
      if (fmt === 'json' || fmt === 'markdown' || fmt === 'md' || fmt === 'text' || fmt === 'txt') {
        format = fmt === 'md' ? 'markdown' : fmt === 'txt' ? 'text' : fmt as ExportFormat;
      } else {
        return {
          success: false,
          error: `Invalid format: ${fmt}. Available: json, markdown, text`,
        };
      }
    } else if (arg === '--output' || arg === '-o') {
      outputPath = args[++i];
      if (!outputPath) {
        return {
          success: false,
          error: 'Please provide an output path after --output',
        };
      }
      // Make relative paths absolute
      if (!path.isAbsolute(outputPath)) {
        outputPath = path.join(cwd, outputPath);
      }
    } else if (!arg.startsWith('-')) {
      sessionId = arg;
    }
  }

  try {
    let content: string;

    if (sessionId) {
      content = await sessionManager.export(sessionId, format, outputPath);
    } else {
      // Export current session
      const current = sessionManager.getCurrent();

      if (!current) {
        return {
          success: false,
          error: 'No active session. Provide a session ID or start a new session.',
        };
      }

      content = await sessionManager.exportCurrent(format, outputPath);
      sessionId = current.id;
    }

    if (outputPath) {
      return {
        success: true,
        message: `Session ${sessionId} exported to ${outputPath} (${format})`,
      };
    } else {
      return {
        success: true,
        message: `Session ${sessionId} (${format}):\n\n${content}`,
        output: content,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}
```

---

### File 10: `src/index.tsx` (Updated)

**Purpose**: Add `--resume` and `--session` flag parsing.

```typescript
#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { App } from './ui/app.js';
import { SessionManager } from './session/manager.js';

// Parse CLI args
const args = process.argv.slice(2);

// Extract flags
let model = 'grok-4-1-fast';
let resumeLatest = false;
let sessionId: string | undefined;
let globalStorage = false;

const promptParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--model' || arg === '-m') {
    model = args[++i] || model;
  } else if (arg === '--resume' || arg === '-r') {
    resumeLatest = true;
  } else if (arg === '--session' || arg === '-s') {
    sessionId = args[++i];
  } else if (arg === '--global' || arg === '-g') {
    globalStorage = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
grok-cli - Claude Code clone for xAI Grok

Usage:
  grok [options] [prompt]

Options:
  -m, --model <model>     Model to use (default: grok-4-1-fast)
  -r, --resume            Resume the most recent session
  -s, --session <id>      Resume a specific session by ID
  -g, --global            Use global (~/.grok/) storage
  -h, --help              Show this help message

Session Commands (in chat):
  /session list           List all sessions
  /session info <id>      Show session details
  /session delete <id>    Delete a session
  /resume [id]            Resume a session
  /rename <name>          Rename current session
  /export [id] [options]  Export session
  /help                   Show all commands

Examples:
  grok "Fix the bug in app.ts"
  grok --resume
  grok --session a1b2c3d4
  grok -m grok-4 "Complex task"
`);
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    promptParts.push(arg);
  }
}

const prompt = promptParts.join(' ');

// Initialize session manager
const sessionManager = new SessionManager({
  location: globalStorage ? 'global' : 'local',
  autoSave: true,
});

// Handle session resumption
async function initSession(): Promise<{ messages: any[]; sessionId?: string } | null> {
  if (sessionId) {
    const session = await sessionManager.load(sessionId);
    if (session) {
      return { messages: session.messages, sessionId: session.id };
    }
    console.error(`Session not found: ${sessionId}`);
    return null;
  }

  if (resumeLatest) {
    const session = await sessionManager.loadLatest();
    if (session) {
      return { messages: session.messages, sessionId: session.id };
    }
    console.log('No previous session found. Starting fresh.');
  }

  return null;
}

// Start the app
(async () => {
  const resumedSession = await initSession();

  render(
    <App
      initialPrompt={prompt}
      model={model}
      sessionManager={sessionManager}
      resumedSession={resumedSession}
    />
  );
})();
```

---

### File 11: `src/ui/app.tsx` (Updated)

**Purpose**: Integrate session state with the UI.

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
import { SessionManager } from '../session/manager.js';
import { commandRegistry, parseSlashCommand, isSlashCommand } from '../commands/registry.js';
import { CommandContext, CommandResult } from '../commands/types.js';

interface AppProps {
  initialPrompt?: string;
  model?: string;
  sessionManager: SessionManager;
  resumedSession?: { messages: any[]; sessionId?: string } | null;
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

export function App({ initialPrompt, model, sessionManager, resumedSession }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(initialPrompt ? 'running' : 'idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [toolOutputs, setToolOutputs] = useState<ToolOutputItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [agent] = useState(() => new GrokAgent({ model }));

  // Anti-flickering: Buffer for streaming text
  const textBufferRef = useRef('');
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingTextRef = useRef('');

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      if (resumedSession?.sessionId) {
        // Resumed session - load messages to display
        const displayMessages = resumedSession.messages
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .filter((m: any) => m.content)
          .map((m: any) => ({
            id: generateId(),
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          }));
        setMessages(displayMessages);

        // Inject messages into agent (for context)
        agent.setMessages(resumedSession.messages);
      } else {
        // New session - create it
        await sessionManager.create({
          model,
          cwd: process.cwd(),
        });
      }
    };

    initSession();
  }, []);

  // Flush buffered text to state (batched updates prevent flickering)
  const flushBuffer = useCallback(() => {
    if (textBufferRef.current) {
      setStreamingText(prev => {
        const updated = prev + textBufferRef.current;
        streamingTextRef.current = updated;  // Keep ref in sync
        return updated;
      });
      textBufferRef.current = '';
    }
    flushTimerRef.current = null;
  }, []);

  // Add text to buffer with debounced flush (50ms batching)
  const appendText = useCallback((text: string) => {
    textBufferRef.current += text;
    streamingTextRef.current += text;  // Keep ref in sync
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
    streamingTextRef.current = '';
    setError(null);
    textBufferRef.current = '';
    setCommandOutput(null);

    // Save user message to session
    await sessionManager.addMessage({ role: 'user', content: prompt });

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
            // Clear pending flush timer
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }

            // Capture ALL text
            const fullText = streamingTextRef.current + textBufferRef.current;
            textBufferRef.current = '';
            streamingTextRef.current = '';

            // Save assistant response to session
            if (fullText) {
              await sessionManager.addMessage({ role: 'assistant', content: fullText });
            }

            // Update messages from agent (includes tool calls)
            await sessionManager.updateMessages(agent.getMessages());

            // Update UI
            flushSync(() => {
              setStreamingText('');
              if (fullText) {
                setMessages(prev => [...prev, {
                  id: generateId(),
                  role: 'assistant',
                  content: fullText
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
  }, [agent, handleConfirmation, appendText, flushBuffer, sessionManager]);

  // Handle slash commands
  const handleSlashCommand = useCallback(async (input: string): Promise<boolean> => {
    if (!isSlashCommand(input)) {
      return false;
    }

    const { name, args } = parseSlashCommand(input);

    const context: CommandContext = {
      sessionManager,
      cwd: process.cwd(),
      model: model || 'grok-4-1-fast',
      exit,
    };

    const result = await commandRegistry.execute(name, args, context);

    if (result.message) {
      setCommandOutput(result.message);
    }

    if (result.error) {
      setError(result.error);
    }

    // Handle resume command - reload messages
    if (result.data?.messages) {
      const displayMessages = (result.data.messages as any[])
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .filter((m: any) => m.content)
        .map((m: any) => ({
          id: generateId(),
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        }));
      setMessages(displayMessages);

      // Update agent messages
      agent.setMessages(result.data.messages as any[]);
    }

    return true;
  }, [sessionManager, model, exit, agent]);

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
  const handleSubmit = useCallback(async (value: string) => {
    setCommandOutput(null);
    setError(null);

    // Check for slash commands first
    if (isSlashCommand(value)) {
      await handleSlashCommand(value);
      return;
    }

    if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
      exit();
      return;
    }

    setMessages(prev => [...prev, { id: generateId(), role: 'user', content: value }]);
    runAgent(value);
  }, [exit, runAgent, handleSlashCommand]);

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

  // Consolidate all static items
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
  const currentSession = sessionManager.getCurrent();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header with session info */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>grok-cli</Text>
        <Text color="gray"> - Claude Code for xAI Grok</Text>
        {currentSession && (
          <Text color="gray"> [{currentSession.id}]</Text>
        )}
      </Box>

      {/* Todo Display */}
      {todos.length > 0 && <TodoDisplay todos={todos} />}

      {/* Command output */}
      {commandOutput && (
        <Box marginY={1} borderStyle="single" borderColor="blue" padding={1}>
          <Text>{commandOutput}</Text>
        </Box>
      )}

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

### File 12: `src/agent/grok-agent.ts` (Updated)

**Purpose**: Add methods for session integration (get/set messages).

Add these methods to the existing `GrokAgent` class:

```typescript
// Add to the GrokAgent class:

  /**
   * Get the current message history.
   * Used for session persistence.
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Set the message history.
   * Used when resuming a session.
   */
  setMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  /**
   * Clear the message history.
   */
  clearMessages(): void {
    this.messages = [];
  }
```

---

## Directory Structure After Implementation

```
src/
├── session/
│   ├── types.ts              # NEW: Session interfaces and types
│   ├── storage.ts            # NEW: File-based persistence
│   └── manager.ts            # NEW: High-level session operations
├── commands/
│   ├── types.ts              # NEW: Command system interfaces
│   ├── registry.ts           # NEW: Command registration
│   └── handlers/
│       └── session/
│           ├── session.ts    # NEW: /session command
│           ├── resume.ts     # NEW: /resume command
│           ├── rename.ts     # NEW: /rename command
│           └── export.ts     # NEW: /export command
├── agent/
│   └── grok-agent.ts         # MODIFIED: Add get/set messages
├── ui/
│   └── app.tsx               # MODIFIED: Session state integration
└── index.tsx                 # MODIFIED: CLI flag parsing
```

---

## Implementation Order

1. **Create types first**: `src/session/types.ts`
2. **Create storage layer**: `src/session/storage.ts`
3. **Create manager**: `src/session/manager.ts`
4. **Create command types**: `src/commands/types.ts`
5. **Create command handlers**:
   - `src/commands/handlers/session/session.ts`
   - `src/commands/handlers/session/resume.ts`
   - `src/commands/handlers/session/rename.ts`
   - `src/commands/handlers/session/export.ts`
6. **Create registry**: `src/commands/registry.ts`
7. **Update agent**: Add methods to `src/agent/grok-agent.ts`
8. **Update index**: `src/index.tsx`
9. **Update app**: `src/ui/app.tsx`

---

## Verification Checklist

### Session Storage
- [ ] Sessions save to `.grok/sessions/` directory
- [ ] Session IDs are 8-character hex strings
- [ ] Sessions load correctly by ID
- [ ] Latest session can be retrieved
- [ ] Sessions can be deleted
- [ ] Session list is sorted by modification time

### Session Manager
- [ ] New sessions are created automatically
- [ ] Messages are saved after each turn
- [ ] Sessions can be renamed
- [ ] Sessions can be exported as JSON
- [ ] Sessions can be exported as Markdown
- [ ] Sessions can be exported as text

### CLI Flags
- [ ] `grok --resume` loads the most recent session
- [ ] `grok --session <id>` loads a specific session
- [ ] `grok --global` uses `~/.grok/` storage
- [ ] `grok --help` shows help text

### Slash Commands
- [ ] `/session list` shows all sessions
- [ ] `/session info` shows current session
- [ ] `/session info <id>` shows specific session
- [ ] `/session delete <id>` deletes a session
- [ ] `/session clear --yes` clears all sessions
- [ ] `/resume` resumes the latest session
- [ ] `/resume <id>` resumes specific session
- [ ] `/rename <name>` renames current session
- [ ] `/export` exports to stdout
- [ ] `/export --output file.json` exports to file
- [ ] `/help` shows all commands

### Integration
- [ ] Session ID is shown in header
- [ ] Command output is displayed in bordered box
- [ ] Resumed sessions show recent context
- [ ] Messages persist across restarts

---

## Error Handling

1. **Missing session**: Clear error message with suggestions
2. **Corrupted session file**: Skip and log warning
3. **Storage permission error**: Fall back to memory-only mode
4. **Invalid session ID**: Try partial match before failing
5. **Export path error**: Create directories as needed

---

## Notes for Executing Claude

1. **Create directories first**: `mkdir -p src/session src/commands/handlers/session`
2. **Follow implementation order**: Types -> Storage -> Manager -> Commands -> UI
3. **Test incrementally**: Verify each component before moving on
4. **Handle edge cases**: Empty sessions, corrupted files, missing directories
5. **Maintain backward compatibility**: Existing Phase 1 code should work unchanged

---

*Generated by Claude Opus 4.5*
