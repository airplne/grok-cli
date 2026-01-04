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
