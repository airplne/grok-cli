import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promptCommand } from '../../src/commands/handlers/prompt.js';
import type { ParsedCommand, CommandContext } from '../../src/commands/types.js';

/**
 * Tests for /prompt command security and functionality.
 *
 * Covers:
 * - Secure path validation (uses path-validator, not raw fs)
 * - 256KB max file size
 * - Forbidden path blocking (/etc/passwd, .env, etc.)
 * - Directory rejection
 * - Empty file rejection
 * - submit_prompt action generation
 */

describe('/prompt command', () => {
  // Mock command context
  const createContext = (cwd?: string): CommandContext => ({
    currentModel: 'grok-4-1-fast',
    setModel: () => {},
    getHistory: () => [],
    clearHistory: () => {},
    exit: () => {},
    cwd: cwd || process.cwd(),
    offlineMode: false,
  });

  // Helper to create parsed command
  const createParsedCommand = (args: string[]): ParsedCommand => ({
    name: 'prompt',
    rawArgs: args.join(' '),
    args,
    flags: {},
  });

  describe('security validation', () => {
    it('should reject forbidden path: /etc/passwd', async () => {
      const parsed = createParsedCommand(['/etc/passwd']);
      const result = await promptCommand.execute(parsed, createContext());

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied|Path traversal blocked|restricted/i);
    });

    it('should reject .env files', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const envFile = path.join(tempDir, '.env');
        await fs.writeFile(envFile, 'SECRET_KEY=12345', 'utf8');

        const parsed = createParsedCommand([envFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(false);
        expect(result.error).toContain('Access denied');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should allow .env.example files', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const envFile = path.join(tempDir, '.env.example');
        await fs.writeFile(envFile, 'SECRET_KEY=changeme', 'utf8');

        const parsed = createParsedCommand([envFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(true);
        expect(result.action?.type).toBe('submit_prompt');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject path outside allowed directories', async () => {
      // /etc/passwd should be blocked (outside cwd/home)
      const parsed = createParsedCommand(['/etc/passwd']);
      const result = await promptCommand.execute(parsed, createContext());

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied|Path traversal blocked/i);
    });
  });

  describe('file validation', () => {
    it('should reject missing file path argument', async () => {
      const parsed = createParsedCommand([]);
      const result = await promptCommand.execute(parsed, createContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing file path');
    });

    it('should reject non-existent file', async () => {
      const testCwd = process.cwd();
      const nonExistent = path.join(testCwd, 'does-not-exist-12345.txt');
      const parsed = createParsedCommand([nonExistent]);
      const result = await promptCommand.execute(parsed, createContext(testCwd));

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/does not exist|not found/i);
    });

    it('should reject directory path', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const parsed = createParsedCommand([tempDir]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(false);
        expect(result.error).toContain('Not a file');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject empty file', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const emptyFile = path.join(tempDir, 'empty.txt');
        await fs.writeFile(emptyFile, '', 'utf8');

        const parsed = createParsedCommand([emptyFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(false);
        expect(result.error).toContain('empty');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject whitespace-only file', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const whitespaceFile = path.join(tempDir, 'whitespace.txt');
        await fs.writeFile(whitespaceFile, '   \n\t\n   ', 'utf8');

        const parsed = createParsedCommand([whitespaceFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(false);
        expect(result.error).toContain('whitespace');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject file exceeding 256KB limit', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const largeFile = path.join(tempDir, 'large.txt');
        const content = 'x'.repeat(300000); // 300KB
        await fs.writeFile(largeFile, content, 'utf8');

        const parsed = createParsedCommand([largeFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(false);
        expect(result.error).toContain('too large');
        expect(result.error).toContain('256KB');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('successful execution', () => {
    it('should load valid file and return submit_prompt action', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const promptFile = path.join(tempDir, 'test-prompt.txt');
        const content = 'This is a test prompt\nwith multiple lines\nand some content.';
        await fs.writeFile(promptFile, content, 'utf8');

        const parsed = createParsedCommand([promptFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(true);
        expect(result.action).toBeDefined();
        expect(result.action?.type).toBe('submit_prompt');
        expect((result.action as any)?.content).toBe(content);
        expect(result.output).toContain('Loaded prompt');
        expect(result.output).toContain('3 lines');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle relative paths', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const promptFile = path.join(tempDir, 'relative.txt');
        await fs.writeFile(promptFile, 'Relative path test', 'utf8');

        const parsed = createParsedCommand(['./relative.txt']);
        const result = await promptCommand.execute(parsed, createContext(tempDir));

        expect(result.success).toBe(true);
        expect(result.action?.type).toBe('submit_prompt');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should preserve multi-line content exactly', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const promptFile = path.join(tempDir, 'multiline.txt');
        const content = 'Line 1\nLine 2\n  Indented line\n\nBlank line above';
        await fs.writeFile(promptFile, content, 'utf8');

        const parsed = createParsedCommand([promptFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(true);
        expect((result.action as any)?.content).toBe(content);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should trim leading/trailing whitespace but preserve internal whitespace', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const promptFile = path.join(tempDir, 'trim-test.txt');
        const contentWithWhitespace = '\n\n  Content here  \n\n';
        const expectedTrimmed = 'Content here';
        await fs.writeFile(promptFile, contentWithWhitespace, 'utf8');

        const parsed = createParsedCommand([promptFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(true);
        expect((result.action as any)?.content).toBe(expectedTrimmed);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should accept file up to 256KB exactly', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const promptFile = path.join(tempDir, 'max-size.txt');
        const content = 'x'.repeat(262144); // Exactly 256KB
        await fs.writeFile(promptFile, content, 'utf8');

        const parsed = createParsedCommand([promptFile]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        expect(result.success).toBe(true);
        expect(result.action?.type).toBe('submit_prompt');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle file path with bracketed paste markers (regression)', async () => {
      const testCwd = process.cwd();
      const tempDir = path.join(testCwd, '.tmp-prompt-test-' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const promptFile = path.join(tempDir, 'test-file.txt');
        await fs.writeFile(promptFile, 'test content', 'utf8');

        // Simulate what happens if paste markers leak into args
        // Parser should sanitize, but handler also has belt-and-suspenders
        const corruptedPath = promptFile + '[200~';
        const parsed = createParsedCommand([corruptedPath]);
        const result = await promptCommand.execute(parsed, createContext(testCwd));

        // Should succeed because handler sanitizes the path
        expect(result.success).toBe(true);
        expect(result.action?.type).toBe('submit_prompt');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('command metadata', () => {
    it('should have correct aliases', () => {
      expect(promptCommand.aliases).toContain('promptfile');
      expect(promptCommand.aliases).toContain('pf');
      expect(promptCommand.aliases).toContain('loadprompt');
    });

    it('should have proper usage documentation', () => {
      expect(promptCommand.usage).toContain('/prompt <file_path>');
      expect(promptCommand.examples.length).toBeGreaterThan(0);
    });

    it('should have required argument definition', () => {
      const filePathArg = promptCommand.arguments.find(a => a.name === 'file_path');
      expect(filePathArg).toBeDefined();
      expect(filePathArg?.required).toBe(true);
      expect(filePathArg?.type).toBe('string');
    });
  });
});
