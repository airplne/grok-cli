/**
 * Auth Command Handler
 *
 * Handles auth login, auth logout, auth status commands
 * KEYCHAIN-ONLY: No environment variable support
 */

import { AuthService } from '../../auth/auth-service.js';

/**
 * CLI mode auth handler (used when running "grok auth <subcommand>")
 * Executes standalone, exits after completion
 */
export async function handleAuthCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'login':
      await handleLogin();
      break;

    case 'logout':
      await handleLogout(flags);
      break;

    case 'status':
      await handleStatus();
      break;

    default:
      console.error(`Error: Unknown auth subcommand: ${subcommand || '(none)'}`);
      console.log('\nUsage:');
      console.log('  grok auth login             Store API key securely in keychain');
      console.log('  grok auth logout [--force]  Remove stored API key');
      console.log('  grok auth status            Check credential status\n');
      console.log('Credentials are stored in system keychain and expire after 7 days.');
      process.exit(1);
  }
}

async function handleLogin(): Promise<void> {
  const result = await AuthService.login();
  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

async function handleLogout(flags: Record<string, string | boolean>): Promise<void> {
  const force = flags.force === true || flags.f === true;
  const result = await AuthService.logout({ force });
  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

async function handleStatus(): Promise<void> {
  const result = await AuthService.status();
  console.log(result.message);
  process.exit(0);
}
