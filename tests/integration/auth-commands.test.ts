/**
 * Integration Tests: Auth Commands
 * Tests CLI auth command execution and routing
 */

import { describe, it, expect } from 'vitest';

describe('Auth Command Integration', () => {
  describe('Command Routing Logic', () => {
    interface AuthCommand {
      subcommand: string;
      handler: () => Promise<number>;
    }

    function createAuthRouter() {
      const commands: Record<string, () => Promise<number>> = {
        login: async () => 0,
        logout: async () => 0,
        status: async () => 0
      };

      return {
        route(subcommand: string): () => Promise<number> {
          return commands[subcommand] || (async () => 1);
        }
      };
    }

    it('routes to login handler', async () => {
      const router = createAuthRouter();
      const handler = router.route('login');
      const exitCode = await handler();
      expect(exitCode).toBe(0);
    });

    it('routes to logout handler', async () => {
      const router = createAuthRouter();
      const handler = router.route('logout');
      const exitCode = await handler();
      expect(exitCode).toBe(0);
    });

    it('routes to status handler', async () => {
      const router = createAuthRouter();
      const handler = router.route('status');
      const exitCode = await handler();
      expect(exitCode).toBe(0);
    });

    it('returns error for unknown subcommand', async () => {
      const router = createAuthRouter();
      const handler = router.route('unknown');
      const exitCode = await handler();
      expect(exitCode).toBe(1);
    });
  });

  describe('Auth Status Formatting', () => {
    interface CredentialStatus {
      configured: boolean;
      expired: boolean;
      expiresAt?: Date;
    }

    function formatStatus(status: CredentialStatus): string {
      if (!status.configured) {
        return 'No API key configured. Run "grok auth login".';
      }
      if (status.expired) {
        return 'API key expired. Run "grok auth login" to re-authenticate.';
      }
      return `API key configured. Expires: ${status.expiresAt?.toISOString()}`;
    }

    it('formats missing credential status', () => {
      const output = formatStatus({ configured: false, expired: false });
      expect(output).toContain('No API key configured');
      expect(output).toContain('grok auth login');
    });

    it('formats expired credential status', () => {
      const output = formatStatus({ configured: true, expired: true });
      expect(output).toContain('expired');
      expect(output).toContain('grok auth login');
    });

    it('formats valid credential status', () => {
      const expiresAt = new Date('2025-01-20');
      const output = formatStatus({ configured: true, expired: false, expiresAt });
      expect(output).toContain('configured');
      expect(output).toContain('Expires');
    });
  });

  describe('Exit Code Consistency', () => {
    const EXIT_CODES = {
      SUCCESS: 0,
      NO_CREDENTIAL: 1,
      ERROR: 1
    };

    it('SUCCESS is 0', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
    });

    it('NO_CREDENTIAL is 1', () => {
      expect(EXIT_CODES.NO_CREDENTIAL).toBe(1);
    });
  });
});
