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

    case 'doctor':
      await handleDoctor();
      break;

    default:
      console.error(`Error: Unknown auth subcommand: ${subcommand || '(none)'}`);
      console.log('\nUsage:');
      console.log('  grok auth login             Store API key securely in keychain');
      console.log('  grok auth logout [--force]  Remove stored API key');
      console.log('  grok auth status            Check credential status');
      console.log('  grok auth doctor            Diagnose keychain availability\n');
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

async function handleDoctor(): Promise<void> {
  console.log('Keychain Diagnostics\n');

  // Import CredentialStore to use getAvailability()
  const { CredentialStore } = await import('../../auth/credential-store.js');

  const availability = await CredentialStore.getAvailability();

  if (availability.available) {
    console.log('[OK] System keychain is available');
    console.log('   Platform:', process.platform);
    console.log('   Node version:', process.version);
    console.log('\nInfo: You can use `grok auth login` to store credentials securely.');
  } else {
    console.log('[ERROR] System keychain is NOT available');
    console.log('   Platform:', process.platform);
    console.log('   Node version:', process.version);
    console.log('   Reason:', availability.reason);
    console.log('\nError details:');
    console.log('  ', availability.errorMessage);
    console.log('\nRemediation:\n');
    console.log(availability.remediation);
    console.log('\nInfo: After fixing, run: grok auth doctor');
    console.log('   Then try: grok auth login');
  }

  process.exit(0);
}
