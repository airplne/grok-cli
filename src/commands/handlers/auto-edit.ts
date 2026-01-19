/**
 * /auto-edit Command Handler
 *
 * Enables or disables session-level auto-accept for Edit/Write tool confirmations.
 * Does NOT persist across sessions (resets on CLI exit).
 * Does NOT affect Bash (always requires confirmation).
 */

import type { Command, ParsedCommand, CommandContext, CommandResult } from '../types.js';

export const autoEditCommand: Command = {
  name: 'auto-edit',
  description: 'Enable/disable auto-accept for Edit/Write confirmations (session only)',
  usage: '/auto-edit <on|off>',
  arguments: [
    {
      name: 'mode',
      description: 'Enable (on) or disable (off) auto-accept edits',
      required: true,
      type: 'string',
    },
  ],
  examples: [
    '/auto-edit on',
    '/auto-edit off',
  ],
  aliases: ['autoedit', 'ae'],

  async execute(parsed: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const mode = parsed.args[0]?.toLowerCase();

    if (!mode || (mode !== 'on' && mode !== 'off')) {
      return {
        success: false,
        error: 'Invalid argument. Usage: /auto-edit <on|off>\n\n' +
               'Examples:\n' +
               '  /auto-edit on  - Enable auto-accept for Edit/Write\n' +
               '  /auto-edit off - Disable auto-accept',
      };
    }

    const enabled = mode === 'on';

    // Note: This command can't directly set the state since it doesn't have access.
    // We need to add an action type for this.
    return {
      success: true,
      output: enabled
        ? 'Auto-accept edits: ENABLED (session)\n\n' +
          'Edit and Write tools will no longer prompt for confirmation.\n' +
          'Bash will still require confirmation.\n\n' +
          'This setting resets when you exit grok.'
        : 'Auto-accept edits: DISABLED\n\n' +
          'Edit and Write tools will now prompt for confirmation.',
      action: {
        type: 'set_auto_edit',
        enabled,
      },
    };
  },
};
