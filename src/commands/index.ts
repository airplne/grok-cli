/**
 * Command Registry
 *
 * Central registry for all slash commands.
 * Handles command registration, lookup, and dispatch.
 */

import type { Command, ParsedCommand, CommandContext, CommandResult } from './types.js';
import { parseInput, isCommand, parseCommand } from './parser.js';
import { getDidYouMeanSuggestion } from '../ui/utils/command-suggestions.js';

// Import command handlers
import { helpCommand } from './handlers/help.js';
import { modelCommand } from './handlers/model.js';
import { clearCommand } from './handlers/clear.js';
import { exitCommand } from './handlers/exit.js';
import { historyCommand } from './handlers/history.js';
import { authCommand } from './handlers/auth-tui.js';
import { promptCommand } from './handlers/prompt.js';

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
      // Try to provide "did you mean" suggestion
      const suggestion = getDidYouMeanSuggestion(parsed.name, this.getAllCommands());

      let errorMessage = `Unknown command: /${parsed.name}`;

      if (suggestion) {
        const suggestedName = suggestion.matchedAlias
          ? `${suggestion.command.name} (alias: ${suggestion.matchedAlias})`
          : suggestion.command.name;
        errorMessage += `\n\nDid you mean: /${suggestedName}?`;
      }

      errorMessage += '\n\nUse /help to see all available commands.';

      return {
        success: false,
        error: errorMessage,
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
    registryInstance.register(authCommand);
    registryInstance.register(promptCommand);
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
export { authCommand } from './handlers/auth-tui.js';
export { promptCommand } from './handlers/prompt.js';
