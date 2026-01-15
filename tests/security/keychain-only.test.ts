/**
 * Security Tests: Keychain-Only Policy Enforcement
 * Verifies NO environment variable authentication
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

describe('Keychain-Only Security Policy', () => {
  const SRC_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src'
  );

  describe('Source Code Audit', () => {
    function scanForEnvVars(dir: string): string[] {
      const violations: string[] = [];
      const files = fs.readdirSync(dir, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          violations.push(...scanForEnvVars(filePath));
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
          const content = fs.readFileSync(filePath, 'utf-8');

          // Allow help text and comments, but not runtime usage
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip comments and help text
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
              continue;
            }
            if (line.includes('console.log') && line.includes('GROK_API_KEY')) {
              continue; // Help text
            }

            // Check for runtime env var usage
            if (line.includes('process.env.GROK_API_KEY') || line.includes('process.env.XAI_API_KEY')) {
              violations.push(`${filePath}:${i + 1}`);
            }
          }
        }
      }
      return violations;
    }

    it('no process.env.GROK_API_KEY in runtime code', () => {
      const violations = scanForEnvVars(SRC_DIR);

      // Filter out known safe locations (help text, comments)
      const runtimeViolations = violations.filter(v => {
        const filePath = v.split(':')[0];
        const lineNum = parseInt(v.split(':')[1]);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const line = lines[lineNum - 1];

        // Allow in help text
        if (filePath.includes('index.tsx') && line.includes('console.log')) {
          return false;
        }

        return true;
      });

      if (runtimeViolations.length > 0) {
        console.log('Env var violations found:', runtimeViolations);
      }

      expect(runtimeViolations).toEqual([]);
    });
  });

  describe('GrokClient Constructor Policy', () => {
    it('constructor requires apiKey from config (no env fallback)', async () => {
      // Read GrokClient source
      const clientPath = path.join(SRC_DIR, 'client', 'grok-client.ts');
      const content = fs.readFileSync(clientPath, 'utf-8');

      // Verify no env var fallback in constructor
      expect(content).not.toContain('|| process.env.GROK_API_KEY');
      expect(content).not.toContain('|| process.env.XAI_API_KEY');
    });
  });

  describe('Startup Policy', () => {
    it('index.tsx uses CredentialStore (not env vars)', async () => {
      const indexPath = path.join(SRC_DIR, 'index.tsx');
      const content = fs.readFileSync(indexPath, 'utf-8');

      // Should import CredentialStore
      expect(content).toContain('CredentialStore');

      // Should call getKey()
      expect(content).toContain('CredentialStore.getKey()');
    });
  });

  describe('Error Message Policy', () => {
    it('error messages mention keychain, not env vars', async () => {
      const authServicePath = path.join(SRC_DIR, 'auth', 'auth-service.ts');
      const content = fs.readFileSync(authServicePath, 'utf-8');

      // Should mention keychain/keytar in error messages
      expect(content.toLowerCase()).toContain('keychain');
      expect(content.toLowerCase()).toContain('keytar');

      // Should recommend grok auth login
      expect(content).toContain('grok auth login');
    });
  });
});
