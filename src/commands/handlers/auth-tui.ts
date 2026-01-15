/**
 * /auth Command Handler (TUI mode)
 *
 * Handles auth login, logout, status within the TUI.
 * KEYCHAIN-ONLY: No environment variable support.
 * Usage: /auth <login|logout|status>
 */

import type { Command, CommandResult, ParsedCommand, CommandContext } from '../types.js';
import { AuthService } from '../../auth/auth-service.js';

export const authCommand: Command = {
  name: 'auth',
  description: 'Manage API key credentials',
  usage: '/auth <login|logout|status>',
  arguments: [
    {
      name: 'subcommand',
      description: 'Auth operation (login, logout, status)',
      required: true,
      type: 'string',
    },
  ],
  examples: [
    '/auth login   - Store API key in keychain',
    '/auth logout  - Remove stored credential',
    '/auth status  - Check credential status',
  ],
  aliases: [],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const subcommand = args.args[0]?.toLowerCase();

    switch (subcommand) {
      case 'login': {
        const loginResult = await AuthService.login();
        return {
          success: loginResult.success,
          output: loginResult.message + '\n\nInfo: Restart grok to enable AI mode',
          action: { type: 'none' },
        };
      }

      case 'logout': {
        const force = args.flags.force === true || args.flags.f === true;
        const logoutResult = await AuthService.logout({ force });
        return {
          success: logoutResult.success,
          output: logoutResult.message + '\n\nInfo: Restart grok to enter offline mode',
          action: { type: 'none' },
        };
      }

      case 'status': {
        const statusResult = await AuthService.status();
        return {
          success: true,
          output: statusResult.message,
          action: { type: 'none' },
        };
      }

      default:
        return {
          success: false,
          error:
            `Error: Unknown auth subcommand: ${subcommand || '(none)'}\n\n` +
            'Usage:\n' +
            '  /auth login   - Store API key securely\n' +
            '  /auth logout  - Remove stored API key\n' +
            '  /auth status  - Check credential status',
        };
    }
  },
};

export default authCommand;
