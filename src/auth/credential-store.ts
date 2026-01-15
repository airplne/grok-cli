/**
 * Credential Store with TTL
 *
 * Securely stores API keys with expiration metadata in system keychain.
 * Credentials expire after 7 days and require re-login.
 *
 * KEYCHAIN-ONLY: No environment variable fallback.
 */

import type keytar from 'keytar';

const SERVICE_NAME = 'grok-cli';
const ACCOUNT_METADATA = 'api-key-metadata';

// TTL: 7 days in milliseconds
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000 ms

export interface CredentialMetadata {
  apiKey: string;
  storedAt: number; // UTC timestamp (ms)
  expiresAt: number; // UTC timestamp (ms)
}

let keytarModule: typeof keytar | null = null;
let keytarError: Error | null = null;

/**
 * Lazy-load keytar to handle build failures gracefully
 */
async function getKeytar(): Promise<typeof keytar | null> {
  if (keytarModule) return keytarModule;
  if (keytarError) return null;

  try {
    keytarModule = await import('keytar');
    return keytarModule;
  } catch (err) {
    keytarError = err as Error;
    console.warn('Warning: System keychain unavailable (keytar failed to load)');
    console.warn('   Credential storage disabled. CLI will run in offline mode.');
    console.warn('   To enable AI features, install system dependencies:');
    console.warn('   - macOS: xcode-select --install');
    console.warn('   - Linux: sudo apt install build-essential libsecret-1-dev');
    console.warn('   - Windows: npm install --global windows-build-tools');
    return null;
  }
}

export class CredentialStore {
  /**
   * Store API key with expiration metadata in system keychain
   * TTL: 7 days from storage time
   */
  static async setKey(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key cannot be empty');
    }

    const kt = await getKeytar();
    if (!kt) {
      throw new Error(
        'System keychain unavailable. Cannot store credential securely.'
      );
    }

    const now = Date.now();
    const metadata: CredentialMetadata = {
      apiKey,
      storedAt: now,
      expiresAt: now + TTL_MS,
    };

    // Store metadata as JSON
    const metadataJson = JSON.stringify(metadata);
    await kt.setPassword(SERVICE_NAME, ACCOUNT_METADATA, metadataJson);
  }

  /**
   * Retrieve API key with expiration checking
   * Returns null if:
   * - Not found
   * - Expired
   * - Invalid metadata
   */
  static async getKey(): Promise<CredentialMetadata | null> {
    const kt = await getKeytar();
    if (!kt) return null;

    try {
      const metadataJson = await kt.getPassword(SERVICE_NAME, ACCOUNT_METADATA);

      if (!metadataJson) {
        return null;
      }

      const metadata: CredentialMetadata = JSON.parse(metadataJson);

      // Validate metadata structure
      if (!metadata.apiKey || !metadata.storedAt || !metadata.expiresAt) {
        console.warn('Warning: Invalid credential metadata, removing...');
        await this.deleteKey();
        return null;
      }

      // Check expiration
      if (this.isExpired(metadata)) {
        return null; // Expired - return null (caller handles offline mode)
      }

      return metadata;
    } catch (err) {
      console.warn('Warning: Failed to read from keychain:', err);
      return null;
    }
  }

  /**
   * Remove API key and metadata from system keychain
   */
  static async deleteKey(): Promise<boolean> {
    const kt = await getKeytar();
    if (!kt) return false;

    try {
      const deleted = await kt.deletePassword(SERVICE_NAME, ACCOUNT_METADATA);
      return deleted;
    } catch (err) {
      console.warn('Warning: Failed to delete from keychain:', err);
      return false;
    }
  }

  /**
   * Check if credential exists (even if expired)
   */
  static async hasKey(): Promise<boolean> {
    const kt = await getKeytar();
    if (!kt) return false;

    try {
      const metadataJson = await kt.getPassword(SERVICE_NAME, ACCOUNT_METADATA);
      return metadataJson !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get credential status including expiration info
   */
  static async getStatus(): Promise<{
    exists: boolean;
    expired: boolean;
    metadata: CredentialMetadata | null;
    daysRemaining?: number;
  }> {
    const metadata = await this.getKey();

    if (!metadata) {
      // Check if expired credential exists
      const kt = await getKeytar();
      if (kt) {
        const metadataJson = await kt.getPassword(SERVICE_NAME, ACCOUNT_METADATA);
        if (metadataJson) {
          try {
            const expiredMeta: CredentialMetadata = JSON.parse(metadataJson);
            return {
              exists: true,
              expired: true,
              metadata: expiredMeta,
              daysRemaining: 0,
            };
          } catch {
            return { exists: false, expired: false, metadata: null };
          }
        }
      }
      return { exists: false, expired: false, metadata: null };
    }

    // Valid credential
    const daysRemaining = Math.ceil(
      (metadata.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)
    );

    return {
      exists: true,
      expired: false,
      metadata,
      daysRemaining,
    };
  }

  /**
   * Check if credential is expired
   */
  static isExpired(metadata: CredentialMetadata): boolean {
    return Date.now() >= metadata.expiresAt;
  }

  /**
   * Check if keytar is available
   */
  static async isAvailable(): Promise<boolean> {
    return (await getKeytar()) !== null;
  }

  /**
   * Get TTL in days
   */
  static getTTLDays(): number {
    return 7;
  }
}
