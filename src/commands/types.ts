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
  | { type: 'submit_prompt'; content: string }
  | { type: 'set_auto_edit'; enabled: boolean }
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
  /** Whether CLI is running in offline mode (no valid credential) */
  offlineMode: boolean;
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
