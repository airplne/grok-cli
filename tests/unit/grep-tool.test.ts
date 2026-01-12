import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { GrepTool } from '../../src/tools/grep.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

describe('GrepTool', () => {
  let tempDir: string;
  let grepTool: GrepTool;

  beforeAll(async () => {
    // Use project-local temp directory to pass path validation (allows cwd and home)
    const projectRoot = process.cwd();
    tempDir = await fs.mkdtemp(path.join(projectRoot, '.tmp-grep-test-'));
    grepTool = new GrepTool();

    // Create test file with various patterns
    const testContent = `line-with-dash
-debug-flag
--double-dash
normal line
DEBUG=true
test pattern here
`;
    await fs.writeFile(path.join(tempDir, 'test.txt'), testContent);

    // Create additional test files for glob filtering
    await fs.writeFile(path.join(tempDir, 'code.ts'), 'const line = "typescript code";');
    await fs.writeFile(path.join(tempDir, 'data.json'), '{"line": "json data"}');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Pattern Handling', () => {
    it('should handle patterns starting with single dash', async () => {
      const result = await grepTool.execute({
        pattern: '-debug',
        path: tempDir,
      });
      expect(result.success).toBe(true);
      // Should find the line with -debug-flag
      expect(result.output).toContain('-debug-flag');
    });

    it('should handle patterns starting with double dash', async () => {
      const result = await grepTool.execute({
        pattern: '--double',
        path: tempDir,
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('--double-dash');
    });

    it('should handle normal patterns', async () => {
      const result = await grepTool.execute({
        pattern: 'normal',
        path: tempDir,
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('normal line');
    });

    it('should handle regex patterns with special characters', async () => {
      const result = await grepTool.execute({
        pattern: 'DEBUG=.*',
        path: tempDir,
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('DEBUG=true');
    });
  });

  describe('Pattern Validation', () => {
    it('should reject invalid hex escape', async () => {
      const result = await grepTool.execute({
        pattern: '\\x',
        path: tempDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('hex escape');
    });

    it('should reject incomplete hex escape with single digit', async () => {
      const result = await grepTool.execute({
        pattern: '\\xF',
        path: tempDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('hex escape');
    });

    it('should reject invalid unicode escape', async () => {
      const result = await grepTool.execute({
        pattern: '\\u12',
        path: tempDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unicode escape');
    });

    it('should reject incomplete unicode escape', async () => {
      const result = await grepTool.execute({
        pattern: '\\u',
        path: tempDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unicode escape');
    });

    it('should accept valid regex patterns', async () => {
      const result = await grepTool.execute({
        pattern: 'test.*pattern',
        path: tempDir,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid hex escape with 2 digits', async () => {
      const result = await grepTool.execute({
        pattern: '\\x41',
        path: tempDir,
      });
      // Should succeed (valid pattern) even if no matches
      expect(result.success).toBe(true);
    });

    it('should accept valid unicode escape with 4 digits', async () => {
      const result = await grepTool.execute({
        pattern: '\\u0041',
        path: tempDir,
      });
      // Should succeed (valid pattern) even if no matches
      expect(result.success).toBe(true);
    });
  });

  describe('Path Validation', () => {
    it('should reject non-existent paths', async () => {
      const result = await grepTool.execute({
        pattern: 'test',
        path: '/nonexistent/path/that/does/not/exist',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should work with valid directory path', async () => {
      const result = await grepTool.execute({
        pattern: 'line',
        path: tempDir,
      });
      expect(result.success).toBe(true);
    });

    it('should work with valid file path', async () => {
      const result = await grepTool.execute({
        pattern: 'normal',
        path: path.join(tempDir, 'test.txt'),
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('normal line');
    });
  });

  describe('Glob Filtering', () => {
    it('should filter by glob pattern *.txt', async () => {
      const result = await grepTool.execute({
        pattern: 'line',
        path: tempDir,
        glob: '*.txt',
      });
      expect(result.success).toBe(true);
      // Should find matches in test.txt
      expect(result.output).toContain('line');
    });

    it('should filter by glob pattern *.ts', async () => {
      const result = await grepTool.execute({
        pattern: 'line',
        path: tempDir,
        glob: '*.ts',
      });
      expect(result.success).toBe(true);
      // Should find matches in code.ts
      expect(result.output).toContain('typescript');
    });

    it('should filter by glob pattern *.json', async () => {
      const result = await grepTool.execute({
        pattern: 'line',
        path: tempDir,
        glob: '*.json',
      });
      expect(result.success).toBe(true);
      // Should find matches in data.json
      expect(result.output).toContain('json');
    });

    it('should return no matches when glob excludes matching files', async () => {
      const result = await grepTool.execute({
        pattern: 'DEBUG',
        path: tempDir,
        glob: '*.json',
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('No matches found');
    });
  });

  describe('No Matches', () => {
    it('should return success with no matches message', async () => {
      const result = await grepTool.execute({
        pattern: 'xyznotfound123',
        path: tempDir,
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('No matches found');
    });

    it('should return success with no matches for complex pattern', async () => {
      const result = await grepTool.execute({
        pattern: 'completely_nonexistent_pattern_12345',
        path: tempDir,
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('No matches found');
    });
  });

  describe('Default Path Behavior', () => {
    it('should use current directory when path not specified', async () => {
      // This test verifies the default path behavior
      const result = await grepTool.execute({
        pattern: 'xyznonexistent987',
        // path not specified - should default to '.'
      });
      // Should succeed even if no matches
      expect(result.success).toBe(true);
    });
  });

  describe('Output Format', () => {
    it('should include line numbers in output', async () => {
      const result = await grepTool.execute({
        pattern: 'normal',
        path: tempDir,
      });
      expect(result.success).toBe(true);
      // ripgrep and grep both use format like filename:linenum:content
      expect(result.output).toMatch(/:\d+:/);
    });
  });

  describe('Fallback Behavior (mocked)', () => {
    let GrepToolMocked: typeof GrepTool;
    let spawnMock: ReturnType<typeof vi.fn>;
    let rgProc: (EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }) | undefined;
    let grepProc: (EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }) | undefined;

    const makeProc = (): ChildProcess & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    } => {
      const proc = new EventEmitter() as ChildProcess & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      return proc;
    };

    const flushImmediate = () => new Promise<void>((resolve) => setImmediate(resolve));

    beforeEach(async () => {
      vi.resetModules();
      rgProc = undefined;
      grepProc = undefined;
      spawnMock = vi.fn((command: string) => {
        const proc = makeProc();
        if (command === 'rg') {
          rgProc = proc;
        }
        if (command === 'grep') {
          grepProc = proc;
        }
        return proc;
      });

      vi.doMock('child_process', () => ({ spawn: spawnMock }));
      vi.doMock('../../src/security/path-validator.js', () => ({
        validatePath: vi.fn(async () => ({ valid: true, resolvedPath: '/tmp' })),
      }));

      const mod = await import('../../src/tools/grep.js');
      GrepToolMocked = mod.GrepTool;
    });

    afterEach(() => {
      vi.resetModules();
      vi.unmock('child_process');
      vi.unmock('../../src/security/path-validator.js');
    });

    it('shows helpful error when both tools are missing', async () => {
      const tool = new GrepToolMocked();
      const resultPromise = tool.execute({ pattern: 'test', path: '/tmp' });

      // Allow the tool to finish async validation and start the initial rg process.
      await flushImmediate();

      const rgError = new Error('spawn rg ENOENT') as NodeJS.ErrnoException;
      rgError.code = 'ENOENT';
      rgProc?.emit('error', rgError);

      // Allow fallback to spawn grep.
      await flushImmediate();

      const grepError = new Error('spawn grep ENOENT') as NodeJS.ErrnoException;
      grepError.code = 'ENOENT';
      grepProc?.emit('error', grepError);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Neither ripgrep (rg) nor grep is installed');
    });

    it('includes fallback prefix on error paths', async () => {
      const tool = new GrepToolMocked();
      const resultPromise = tool.execute({ pattern: 'test', path: '/tmp' });

      // Allow the tool to finish async validation and start the initial rg process.
      await flushImmediate();

      const rgError = new Error('spawn rg ENOENT') as NodeJS.ErrnoException;
      rgError.code = 'ENOENT';
      rgProc?.emit('error', rgError);

      // Allow fallback to spawn grep.
      await flushImmediate();

      const grepError = new Error('Permission denied') as NodeJS.ErrnoException;
      grepError.code = 'EACCES';
      grepProc?.emit('error', grepError);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Using grep fallback (rg not found).');
      expect(result.error).toContain('Permission denied');
    });

    it('ignores stale events from the initial rg process', async () => {
      const tool = new GrepToolMocked();
      let resolved = false;
      const resultPromise = tool.execute({ pattern: 'test', path: '/tmp' }).then((result) => {
        resolved = true;
        return result;
      });

      // Allow the tool to finish async validation and start the initial rg process.
      await flushImmediate();

      const rgError = new Error('spawn rg ENOENT') as NodeJS.ErrnoException;
      rgError.code = 'ENOENT';
      rgProc?.stdout.emit('data', Buffer.from('rg output'));
      rgProc?.emit('error', rgError);

      // Allow fallback to spawn grep.
      await flushImmediate();

      rgProc?.emit('close', 0);
      await flushImmediate();
      expect(resolved).toBe(false);

      grepProc?.stdout.emit('data', Buffer.from('grep output'));
      grepProc?.emit('close', 0);

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.output).toContain('Using grep fallback (rg not found).');
      expect(result.output).toContain('grep output');
    });
  });
});
