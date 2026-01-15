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
  aliases: ['hist'],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const history = context.getHistory();

    // In offline mode, history might be empty or tool-only
    if (context.offlineMode && history.length === 0) {
      return {
        success: true,
        output: 'No history available (offline mode)\n\n' +
                'AI conversation history is not available in offline mode.\n' +
                'Run \'grok auth login\' to enable AI features.',
        action: { type: 'none' },
      };
    }

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
