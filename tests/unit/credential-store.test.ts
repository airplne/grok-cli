/**
 * Unit Tests: CredentialStore
 * Tests keychain-based credential storage with 7-day TTL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialStore } from '../../src/auth/credential-store.js';

// Create mock functions
const mockSetPassword = vi.fn();
const mockGetPassword = vi.fn();
const mockDeletePassword = vi.fn();

// Mock keytar module
vi.mock('keytar', () => ({
  // CredentialStore uses `await import('keytar')` and calls named exports.
  setPassword: mockSetPassword,
  getPassword: mockGetPassword,
  deletePassword: mockDeletePassword,
}));

describe('CredentialStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPassword.mockResolvedValue(undefined);
    mockGetPassword.mockResolvedValue(null);
    mockDeletePassword.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setKey()', () => {
    it('stores API key with 7-day TTL metadata', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await CredentialStore.setKey('xai-test-key');

      expect(mockSetPassword).toHaveBeenCalled();
      const call = mockSetPassword.mock.calls[0];
      expect(call[0]).toBe('grok-cli');
      expect(call[1]).toBe('api-key-metadata');

      const metadata = JSON.parse(call[2]);
      expect(metadata.apiKey).toBe('xai-test-key');
      expect(metadata.storedAt).toBe(now);
      expect(metadata.expiresAt).toBe(now + 7 * 24 * 60 * 60 * 1000);
    });

    it('rejects empty API key', async () => {
      await expect(CredentialStore.setKey('')).rejects.toThrow('cannot be empty');
    });
  });

  describe('getKey()', () => {
    it('returns valid non-expired credential', async () => {
      const now = Date.now();
      const metadata = {
        apiKey: 'xai-valid-key',
        storedAt: now - 1000,
        expiresAt: now + 1000
      };

      mockGetPassword.mockResolvedValue(JSON.stringify(metadata));

      const result = await CredentialStore.getKey();
      expect(result).not.toBeNull();
      expect(result?.apiKey).toBe('xai-valid-key');
    });

    it('returns null for expired credential', async () => {
      const now = Date.now();
      const metadata = {
        apiKey: 'xai-expired-key',
        storedAt: now - 10 * 24 * 60 * 60 * 1000,
        expiresAt: now - 1000
      };

      mockGetPassword.mockResolvedValue(JSON.stringify(metadata));

      const result = await CredentialStore.getKey();
      expect(result).toBeNull();
    });

    it('returns null for missing credential', async () => {
      mockGetPassword.mockResolvedValue(null);

      const result = await CredentialStore.getKey();
      expect(result).toBeNull();
    });
  });

  describe('deleteKey()', () => {
    it('deletes credential from keychain', async () => {
      mockDeletePassword.mockResolvedValue(true);

      const result = await CredentialStore.deleteKey();
      expect(result).toBe(true);
      expect(mockDeletePassword).toHaveBeenCalled();
    });
  });

  describe('isExpired()', () => {
    it('returns true for expired credential', () => {
      const now = Date.now();
      const metadata = {
        apiKey: 'test',
        storedAt: now - 8 * 24 * 60 * 60 * 1000,
        expiresAt: now - 1000
      };

      expect(CredentialStore.isExpired(metadata)).toBe(true);
    });

    it('returns false for valid credential', () => {
      const now = Date.now();
      const metadata = {
        apiKey: 'test',
        storedAt: now,
        expiresAt: now + 1000
      };

      expect(CredentialStore.isExpired(metadata)).toBe(false);
    });
  });

  describe('getTTLDays()', () => {
    it('returns 7 days', () => {
      expect(CredentialStore.getTTLDays()).toBe(7);
    });
  });
});
