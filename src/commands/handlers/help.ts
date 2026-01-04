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
