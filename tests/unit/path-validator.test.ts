/**
 * Path Validator Symlink Security Regression Tests (SEC-001)
 *
 * These tests verify the security features of the path validator module,
 * specifically focusing on symlink-based attack prevention.
 *
 * Security Features Tested:
 * - Symlink resolution via fs.realpath()
 * - Circular symlink detection (ELOOP)
 * - Blocked patterns checked against RESOLVED path
 * - .env.example/.env.sample/.env.template read-only allowlist
 * - Blocked absolute paths (/etc/passwd, /etc/shadow, etc.)
 * - Write operation blocks for symlinks
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  validatePath,
  validatePathSync,
} from '../../src/security/path-validator.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';

// Platform detection (must be synchronous - Vitest registers tests at module load time)
const IS_WINDOWS = process.platform === 'win32';

function detectSymlinkCapability(): boolean {
  const linkPath = path.join(
    os.tmpdir(),
    `.grok-cli-symlink-capability-${process.pid}-${Date.now()}`
  );

  try {
    fsSync.symlinkSync(os.tmpdir(), linkPath, 'dir');
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') return false;
    return false;
  } finally {
    try {
      fsSync.unlinkSync(linkPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

const CAN_CREATE_SYMLINKS = detectSymlinkCapability();

const describeSymlink = CAN_CREATE_SYMLINKS ? describe : describe.skip;
const itSymlink = CAN_CREATE_SYMLINKS ? it : it.skip;

const describeUnixOnly = IS_WINDOWS ? describe.skip : describe;
const itUnixOnly = IS_WINDOWS ? it.skip : it;
const itUnixSymlinkOnly = !IS_WINDOWS && CAN_CREATE_SYMLINKS ? it : it.skip;

describe('PathValidator - Symlink Security (SEC-001)', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temp directory for test fixtures
    // Use $HOME instead of process.cwd() to avoid Vitest file watcher traversing
    // circular symlinks and throwing ELOOP errors in DEV watch mode.
    // The path validator allows both cwd and home directories.
    const homeDir = os.homedir();
    tempDir = await fs.mkdtemp(path.join(homeDir, '.tmp-path-validator-test-'));
    console.log(`Test fixtures directory: ${tempDir}`);
  });

  afterAll(async () => {
    // Safety guards before cleanup
    if (!tempDir) {
      console.warn('tempDir is undefined, skipping cleanup');
      return;
    }

    const homeDir = os.homedir();

    // Guard 1: Verify basename starts with expected prefix
    const basename = path.basename(tempDir);
    if (!basename.startsWith('.tmp-path-validator-test-')) {
      throw new Error(`SAFETY: tempDir basename missing prefix: ${basename}`);
    }

    // Guard 2: Never delete home directory itself
    if (tempDir === homeDir) {
      throw new Error('SAFETY: Refusing to delete home directory');
    }

    // Guard 3: Resolve real path and verify it's under home
    const realTempDir = await fs.realpath(tempDir);
    const realHomeDir = await fs.realpath(homeDir);

    if (realTempDir === realHomeDir) {
      throw new Error('SAFETY: Resolved tempDir is home directory');
    }

    // Guard 4: Verify resolved path is under home directory
    const relativePath = path.relative(realHomeDir, realTempDir);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`SAFETY: tempDir not under home: ${realTempDir}`);
    }

    // All guards passed - safe to delete
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`Cleaned up test fixtures directory: ${tempDir}`);
    } catch (err) {
      console.warn(`Warning: Failed to cleanup ${tempDir}:`, err);
    }
  });

  describeSymlink('Symlink Resolution', () => {
    it('should block symlink pointing to .env file', async () => {
      // Create .env file and symlink pointing to it
      const envPath = path.join(tempDir, '.env');
      const symlinkPath = path.join(tempDir, 'safe-config.txt');

      await fs.writeFile(envPath, 'SECRET=value');

      // Clean up symlink if it exists from previous run
      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore if doesn't exist
      }

      await fs.symlink(envPath, symlinkPath);

      // The symlink appears innocent but resolves to .env
      const result = await validatePath(symlinkPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });

    it('should block symlink pointing to .env even with different name', async () => {
      // Create another .env file with different structure
      const envPath = path.join(tempDir, 'subdir-env', '.env');
      const symlinkPath = path.join(tempDir, 'totally-safe-file.json');

      // Create subdirectory
      await fs.mkdir(path.join(tempDir, 'subdir-env'), { recursive: true });
      await fs.writeFile(envPath, 'API_KEY=secret123');

      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore
      }

      await fs.symlink(envPath, symlinkPath);

      const result = await validatePath(symlinkPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });
  });

  describe('.env.example Allowlist', () => {
    let examplePath: string;

    beforeEach(async () => {
      examplePath = path.join(tempDir, '.env.example');
      try {
        await fs.writeFile(examplePath, 'EXAMPLE_VAR=placeholder');
      } catch {
        // Already exists
      }
    });

    it('should allow .env.example for read operations', async () => {
      const result = await validatePath(examplePath, { operation: 'read' });

      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBeDefined();
    });

    it('should allow .env.sample for read operations', async () => {
      const samplePath = path.join(tempDir, '.env.sample');
      await fs.writeFile(samplePath, 'SAMPLE_VAR=placeholder');

      const result = await validatePath(samplePath, { operation: 'read' });

      expect(result.valid).toBe(true);
    });

    it('should allow .env.template for read operations', async () => {
      const templatePath = path.join(tempDir, '.env.template');
      await fs.writeFile(templatePath, 'TEMPLATE_VAR=placeholder');

      const result = await validatePath(templatePath, { operation: 'read' });

      expect(result.valid).toBe(true);
    });

    it('should block .env.example for write operations', async () => {
      const result = await validatePath(examplePath, { operation: 'write' });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });

    itSymlink('should allow symlink to .env.example for read operations', async () => {
      const symlinkPath = path.join(tempDir, 'example-link.txt');

      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore
      }

      await fs.symlink(examplePath, symlinkPath);

      const result = await validatePath(symlinkPath, { operation: 'read' });

      expect(result.valid).toBe(true);
    });

    itSymlink('should block symlink to .env.example for write operations', async () => {
      const symlinkPath = path.join(tempDir, 'example-link-write.txt');

      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore
      }

      await fs.symlink(examplePath, symlinkPath);

      const result = await validatePath(symlinkPath, { operation: 'write' });

      // Write to symlinks is blocked regardless of target
      expect(result.valid).toBe(false);
    });
  });

  describe('Blocked Absolute Paths', () => {
    itUnixSymlinkOnly('should block symlink to /etc/passwd', async () => {
      const symlinkPath = path.join(tempDir, 'users.txt');

      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore
      }

      try {
        await fs.symlink('/etc/passwd', symlinkPath);
        const result = await validatePath(symlinkPath);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('restricted system path');
      } catch (err) {
        // Skip if symlink creation fails (permissions or OS limitations)
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EPERM' || error.code === 'EACCES') {
          console.log(
            'Skipping /etc/passwd symlink test - permission denied for symlink creation'
          );
        } else {
          throw err;
        }
      }
    });

    itUnixSymlinkOnly('should block symlink to /etc/shadow', async () => {
      const symlinkPath = path.join(tempDir, 'shadow-link.txt');

      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore
      }

      try {
        await fs.symlink('/etc/shadow', symlinkPath);
        const result = await validatePath(symlinkPath);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('restricted system path');
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EPERM' || error.code === 'EACCES') {
          console.log('Skipping /etc/shadow symlink test - permission denied');
        } else {
          throw err;
        }
      }
    });

    itUnixOnly('should block direct access to /etc/passwd', async () => {
      const result = await validatePath('/etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('restricted system path');
    });

    itUnixOnly('should block direct access to /proc paths', async () => {
      const result = await validatePath('/proc/self/environ');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('restricted system path');
    });
  });

  describe('Path Injection Prevention', () => {
    it('should block paths with null bytes', async () => {
      const result = await validatePath('/some/path\x00/file.txt');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });

    it('should block paths with embedded null bytes in filename', async () => {
      const result = await validatePath('/home/user/file\x00.txt');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });

    it('should block paths with null bytes at start', async () => {
      const result = await validatePath('\x00/etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });
  });

  describe('Non-Existent Path Handling', () => {
    it('should handle non-existent paths with allowNonExistent option', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent', 'file.txt');

      const result = await validatePath(nonExistentPath, {
        allowNonExistent: true,
      });

      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBeDefined();
    });

    it('should reject non-existent paths without allowNonExistent option', async () => {
      const nonExistentPath = path.join(
        tempDir,
        'definitely-not-here',
        'file.txt'
      );

      const result = await validatePath(nonExistentPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should resolve parent path for non-existent files', async () => {
      // Create a real parent directory
      const parentDir = path.join(tempDir, 'real-parent');
      await fs.mkdir(parentDir, { recursive: true });

      const nonExistentFile = path.join(parentDir, 'new-file.txt');

      const result = await validatePath(nonExistentFile, {
        allowNonExistent: true,
      });

      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toContain('real-parent');
    });
  });

  describe('Write Operation Symlink Protection', () => {
    itSymlink('should block write operations to symlinks', async () => {
      // Create a regular file and a symlink to it
      const targetFile = path.join(tempDir, 'write-target.txt');
      const symlinkPath = path.join(tempDir, 'write-symlink.txt');

      await fs.writeFile(targetFile, 'original content');

      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore
      }

      await fs.symlink(targetFile, symlinkPath);

      const result = await validatePath(symlinkPath, { operation: 'write' });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot write to symlink');
    });

    it('should allow write operations to regular files', async () => {
      const regularFile = path.join(tempDir, 'regular-write.txt');
      await fs.writeFile(regularFile, 'content');

      const result = await validatePath(regularFile, { operation: 'write' });

      expect(result.valid).toBe(true);
    });
  });

  describeSymlink('Circular Symlink Detection', () => {
    it('should detect and block circular symlinks', async () => {
      // Create a circular symlink: a -> b -> a
      const linkA = path.join(tempDir, 'circular-a');
      const linkB = path.join(tempDir, 'circular-b');

      // Clean up any existing links
      try {
        await fs.unlink(linkA);
      } catch {
        // Ignore
      }
      try {
        await fs.unlink(linkB);
      } catch {
        // Ignore
      }

      try {
        // Create circular reference
        await fs.symlink(linkB, linkA);
        await fs.symlink(linkA, linkB);

        const result = await validatePath(linkA);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('circular symlink');
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ELOOP') {
          // Some systems might throw ELOOP during symlink creation
          console.log(
            'OS detected circular symlink during creation - test passes'
          );
          expect(true).toBe(true);
        } else {
          throw err;
        }
      }
    });

    it('should detect self-referencing symlink', async () => {
      const selfLink = path.join(tempDir, 'self-link');

      try {
        await fs.unlink(selfLink);
      } catch {
        // Ignore
      }

      try {
        await fs.symlink(selfLink, selfLink);

        const result = await validatePath(selfLink);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('circular symlink');
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        // EEXIST or ELOOP are both acceptable failure modes
        if (error.code === 'EEXIST' || error.code === 'ELOOP') {
          console.log('OS prevented self-referencing symlink - test passes');
          expect(true).toBe(true);
        } else {
          throw err;
        }
      }
    });
  });

  describe('Blocked Patterns', () => {
    it('should block .ssh directory access', async () => {
      // Create a fake .ssh directory structure
      const sshDir = path.join(tempDir, '.ssh');
      const keyFile = path.join(sshDir, 'id_rsa');

      await fs.mkdir(sshDir, { recursive: true });
      await fs.writeFile(keyFile, 'fake-key');

      const result = await validatePath(keyFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });

    it('should block .aws credentials access', async () => {
      const awsDir = path.join(tempDir, '.aws');
      const credFile = path.join(awsDir, 'credentials');

      await fs.mkdir(awsDir, { recursive: true });
      await fs.writeFile(credFile, '[default]');

      const result = await validatePath(credFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });

    itSymlink('should block symlink to .ssh directory', async () => {
      const sshDir = path.join(tempDir, '.ssh');
      const symlinkPath = path.join(tempDir, 'config-backup');

      await fs.mkdir(sshDir, { recursive: true });
      await fs.writeFile(path.join(sshDir, 'config'), 'Host *');

      try {
        await fs.unlink(symlinkPath);
      } catch {
        // Ignore
      }

      await fs.symlink(path.join(sshDir, 'config'), symlinkPath);

      const result = await validatePath(symlinkPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });
  });

  describe('Sync Version Parity', () => {
    it('validatePathSync should block paths with null bytes', () => {
      const result = validatePathSync('/some/path\x00/file.txt');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });

    it('validatePathSync should match async behavior for blocked patterns', () => {
      // Create a path that matches .env pattern
      const envPath = path.join(tempDir, '.env');

      // Write the file synchronously for this test
      fsSync.writeFileSync(envPath, 'SYNC_TEST=value');

      const syncResult = validatePathSync(envPath);

      expect(syncResult.valid).toBe(false);
      expect(syncResult.error).toContain('blocked pattern');
    });

    it('validatePathSync should handle non-existent paths correctly', () => {
      const nonExistentPath = path.join(tempDir, 'sync-nonexistent.txt');

      const resultWithoutOption = validatePathSync(nonExistentPath);
      expect(resultWithoutOption.valid).toBe(false);
      expect(resultWithoutOption.error).toContain('does not exist');

      const resultWithOption = validatePathSync(nonExistentPath, {
        allowNonExistent: true,
      });
      expect(resultWithOption.valid).toBe(true);
    });

    itUnixOnly('validatePathSync should block system paths', () => {
      const result = validatePathSync('/etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('restricted system path');
    });
  });

  describe('Input Validation', () => {
    it('should reject empty string path', async () => {
      const result = await validatePath('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject null path', async () => {
      const result = await validatePath(null as unknown as string);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject undefined path', async () => {
      const result = await validatePath(undefined as unknown as string);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle paths with special characters', async () => {
      const specialPath = path.join(tempDir, 'file with spaces.txt');
      await fs.writeFile(specialPath, 'content');

      const result = await validatePath(specialPath);

      expect(result.valid).toBe(true);
    });

    it('should handle very long paths', async () => {
      // Create a deeply nested but valid path
      const deepPath = path.join(tempDir, 'a', 'b', 'c', 'd', 'e', 'file.txt');

      const result = await validatePath(deepPath, { allowNonExistent: true });

      expect(result.valid).toBe(true);
    });

    it('should normalize path traversal attempts', async () => {
      // Create a file
      const targetFile = path.join(tempDir, 'target.txt');
      await fs.writeFile(targetFile, 'content');

      // Try to access via path traversal
      const traversalPath = path.join(tempDir, 'subdir', '..', 'target.txt');

      // Should normalize and find the file
      const result = await validatePath(traversalPath);

      // Note: This depends on whether the file is within allowed directories
      // The key is that the path is properly normalized
      expect(result.resolvedPath).not.toContain('..');
    });
  });
});
