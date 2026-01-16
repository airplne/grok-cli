/**
 * Auth Service
 *
 * Handles login, logout, and status operations for credential management.
 * KEYCHAIN-ONLY: No environment variable support.
 */

import { CredentialStore } from './credential-store.js';
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';

export interface AuthResult {
  success: boolean;
  message: string;
}

export interface StatusResult {
  configured: boolean;
  message: string;
  details?: {
    provider: string;
    keychainAvailable: boolean;
  };
}

export class AuthService {
  /**
   * Interactive login - prompts for API key and stores it
   */
  static async login(): Promise<AuthResult> {
    try {
      // Check if keytar is available
      const availability = await CredentialStore.getAvailability();
      if (!availability.available) {
        return {
          success: false,
          message:
            'Error: System keychain unavailable\n\n' +
            availability.remediation + '\n\n' +
            'Info: After fixing, run: grok auth doctor\n' +
            '   Then try: grok auth login',
        };
      }

      // Get API key (hidden interactive prompt)
      const apiKey = await this.promptForKey();

      if (!apiKey || apiKey.trim() === '') {
        return { success: false, message: 'Error: API key cannot be empty' };
      }

      // Basic validation (xAI keys typically start with 'xai-')
      if (!apiKey.startsWith('xai-')) {
        console.warn('Warning: API key does not start with "xai-"');
        console.warn('   xAI API keys usually have format: xai-...');
        console.warn('   Continuing anyway...\n');
      }

      // Store in keychain
      await CredentialStore.setKey(apiKey);

      return {
        success: true,
        message:
          'Success: Credential stored securely in system keychain\n' +
          'Success: AI mode will be enabled next time you run grok\n' +
          'Info: Credential expires after 7 days for security',
      };
    } catch (err) {
      return {
        success: false,
        message: `Error: Failed to store credential: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Logout - removes stored credential
   */
  static async logout(options: { force?: boolean } = {}): Promise<AuthResult> {
    try {
      const hasKey = await CredentialStore.hasKey();

      if (!hasKey) {
        return {
          success: false,
          message: 'Info: No credential configured (already in offline mode)',
        };
      }

      // Confirm unless --force
      if (!options.force) {
        const confirmed = await this.confirmLogout();
        if (!confirmed) {
          return { success: false, message: 'Logout cancelled' };
        }
      }

      const deleted = await CredentialStore.deleteKey();

      if (!deleted) {
        return {
          success: false,
          message: 'Error: Failed to remove credential from keychain',
        };
      }

      return {
        success: true,
        message:
          'Success: Credential removed from system keychain\n' +
          'Info: Offline mode will be used next time you run grok',
      };
    } catch (err) {
      return {
        success: false,
        message: `Error: Failed to remove credential: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Check credential status with expiration info
   */
  static async status(): Promise<StatusResult> {
    try {
      const keychainAvailable = await CredentialStore.isAvailable();
      const status = await CredentialStore.getStatus();

      if (!keychainAvailable) {
        const availability = await CredentialStore.getAvailability();
        let message = 'Error: System keychain unavailable\n';
        message += 'Info: Offline mode active\n\n';
        if (!availability.available) {
          message += availability.remediation + '\n\n';
          message += 'Info: After fixing, run: grok auth doctor';
        }

        return {
          configured: false,
          message,
          details: {
            provider: 'None',
            keychainAvailable: false,
          },
        };
      }

      if (status.exists && status.expired) {
        // Credential exists but expired
        const storedDate = new Date(
          status.metadata!.storedAt
        ).toLocaleDateString();
        const expiredDate = new Date(
          status.metadata!.expiresAt
        ).toLocaleDateString();
        const daysAgo = Math.floor(
          (Date.now() - status.metadata!.expiresAt) / (24 * 60 * 60 * 1000)
        );

        return {
          configured: false,
          message:
            `Error: Credential expired (offline mode)\n` +
            `  Last login: ${storedDate}\n` +
            `  Expired: ${expiredDate} (${daysAgo} days ago)\n\n` +
            `  Run 'grok auth login' to re-enable AI`,
          details: {
            provider: 'xAI Grok (expired)',
            keychainAvailable: true,
          },
        };
      }

      if (status.exists && !status.expired) {
        // Valid credential
        const storedDate = new Date(
          status.metadata!.storedAt
        ).toLocaleDateString();
        const expiresDate = new Date(
          status.metadata!.expiresAt
        ).toLocaleDateString();
        const daysRemaining = status.daysRemaining!;

        return {
          configured: true,
          message:
            `Success: Credential configured (AI mode enabled)\n` +
            `  Provider: xAI Grok\n` +
            `  Stored: ${storedDate}\n` +
            `  Expires: ${expiresDate} (in ${daysRemaining} days)\n` +
            `  Storage: System keychain (encrypted)`,
          details: {
            provider: 'xAI Grok',
            keychainAvailable: true,
          },
        };
      }

      // No credential
      return {
        configured: false,
        message:
          "Error: No credential configured (offline mode)\n" +
          "Info: Run 'grok auth login' to enable AI features\n" +
          'Info: Credentials expire after 7 days for security',
        details: {
          provider: 'None',
          keychainAvailable: true,
        },
      };
    } catch (err) {
      return {
        configured: false,
        message: `Error: Error checking credential: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Prompt user for API key (hidden input)
   */
  private static async promptForKey(): Promise<string> {
    const rl = readline.createInterface({ input, output });

    return new Promise((resolve) => {
      let hidden = false;

      rl.question('? Enter your xAI API key: ', (answer) => {
        rl.close();
        console.log(); // New line after hidden input
        resolve(answer.trim());
      });

      // Hide input for security
      rl.on('line', () => {
        hidden = true;
      });

      // Override _writeToOutput to hide characters
      const originalWrite = (rl as unknown as { _writeToOutput: (char: string) => void })._writeToOutput;
      (rl as unknown as { _writeToOutput: (char: string) => void })._writeToOutput = function (char: string) {
        if (!hidden && char !== '\r' && char !== '\n') {
          // Don't echo characters (hidden input)
          return;
        }
        originalWrite.call(this, char);
      };
    });
  }

  /**
   * Confirm logout action
   */
  private static async confirmLogout(): Promise<boolean> {
    const rl = readline.createInterface({ input, output });

    return new Promise((resolve) => {
      rl.question('? Remove stored credential? (y/N) ', (answer) => {
        rl.close();
        const normalized = answer.toLowerCase().trim();
        resolve(normalized === 'y' || normalized === 'yes');
      });
    });
  }

  /**
   * Diagnose keychain availability and provide troubleshooting info
   */
  static async doctor(): Promise<AuthResult> {
    const availability = await CredentialStore.getAvailability();
    const nodeVersion = process.version;
    const platform = process.platform;

    if (availability.available) {
      return {
        success: true,
        message:
          'Keychain Diagnostics\n\n' +
          'System keychain is available\n' +
          `   Platform: ${platform}\n` +
          `   Node version: ${nodeVersion}\n\n` +
          "You can use 'grok auth login' to store credentials securely.",
      };
    }

    // Keychain not available - show diagnostics
    const { reason, errorMessage, remediation } = availability;

    return {
      success: false,
      message:
        'Keychain Diagnostics\n\n' +
        'System keychain is NOT available\n' +
        `   Platform: ${platform}\n` +
        `   Node version: ${nodeVersion}\n` +
        `   Reason: ${reason}\n\n` +
        'Error details:\n' +
        `   ${errorMessage}\n\n` +
        'Remediation:\n\n' +
        remediation +
        '\n\n' +
        "After fixing, run: grok auth doctor\n" +
        "   Then try: grok auth login",
    };
  }
}
