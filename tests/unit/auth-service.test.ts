/**
 * Unit Tests: AuthService
 * Tests login/logout/status operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/auth/auth-service.js';
import { CredentialStore } from '../../src/auth/credential-store.js';

vi.mock('../../src/auth/credential-store.js');

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('status()', () => {
    it('reports valid credential with expiration', async () => {
      const now = Date.now();
      vi.mocked(CredentialStore.isAvailable).mockResolvedValue(true);
      vi.mocked(CredentialStore.getStatus).mockResolvedValue({
        exists: true,
        expired: false,
        metadata: {
          apiKey: 'xai-test',
          storedAt: now,
          expiresAt: now + 7 * 24 * 60 * 60 * 1000
        },
        daysRemaining: 7
      });

      const result = await AuthService.status();

      expect(result.configured).toBe(true);
      expect(result.message).toContain('AI mode enabled');
      expect(result.message).toContain('7 days');
    });

    it('reports expired credential', async () => {
      vi.mocked(CredentialStore.isAvailable).mockResolvedValue(true);
      vi.mocked(CredentialStore.getStatus).mockResolvedValue({
        exists: true,
        expired: true,
        metadata: {
          apiKey: 'xai-test',
          storedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          expiresAt: Date.now() - 3 * 24 * 60 * 60 * 1000
        },
        daysRemaining: 0
      });

      const result = await AuthService.status();

      expect(result.configured).toBe(false);
      expect(result.message).toContain('expired');
      expect(result.message).toContain('grok auth login');
    });

    it('reports missing credential', async () => {
      vi.mocked(CredentialStore.isAvailable).mockResolvedValue(true);
      vi.mocked(CredentialStore.getStatus).mockResolvedValue({
        exists: false,
        expired: false,
        metadata: null
      });

      const result = await AuthService.status();

      expect(result.configured).toBe(false);
      expect(result.message).toContain('No credential configured');
      expect(result.message).toContain('grok auth login');
    });

    it('reports keychain unavailable', async () => {
      vi.mocked(CredentialStore.isAvailable).mockResolvedValue(false);
      vi.mocked(CredentialStore.getAvailability).mockResolvedValue({
        available: false,
        reason: 'missing-native-binding',
        errorMessage: "Cannot find module '../build/Release/keytar.node'",
        remediation: 'Install build tools and rebuild keytar'
      });

      const result = await AuthService.status();

      expect(result.configured).toBe(false);
      expect(result.message).toContain('keychain unavailable');
    });
  });

  describe('logout()', () => {
    it('deletes credential with force flag', async () => {
      vi.mocked(CredentialStore.hasKey).mockResolvedValue(true);
      vi.mocked(CredentialStore.deleteKey).mockResolvedValue(true);

      const result = await AuthService.logout({ force: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('removed');
      expect(CredentialStore.deleteKey).toHaveBeenCalled();
    });

    it('returns early if no credential', async () => {
      vi.mocked(CredentialStore.hasKey).mockResolvedValue(false);

      const result = await AuthService.logout({ force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No credential');
    });
  });
});
