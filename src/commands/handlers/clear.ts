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
