import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

/**
 * Validate grep pattern for common regex issues
 */
function validateGrepPattern(pattern: string): { valid: true } | { valid: false; error: string } {
  // Check for incomplete hex escapes like \x without 2 hex digits
  if (/\\x(?![0-9a-fA-F]{2})/.test(pattern)) {
    return { valid: false, error: 'Incomplete hex escape in pattern (\\x must be followed by 2 hex digits)' };
  }

  // Check for incomplete Unicode escapes like \u without 4 hex digits
  if (/\\u(?![0-9a-fA-F]{4})/.test(pattern)) {
    return { valid: false, error: 'Incomplete Unicode escape in pattern (\\u must be followed by 4 hex digits)' };
  }

  // Try to compile as regex to catch other issues
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid regex pattern' };
  }
}

export class GrepTool extends BaseTool {
  name = 'Grep';
  description = 'Search for a pattern in files using ripgrep. Returns matching lines.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    pattern: z.string().describe('The regex pattern to search for'),
    path: z.string().optional().describe('File or directory to search in'),
    glob: z.string().optional().describe('File pattern to filter (e.g., "*.ts")'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, path: searchPath = '.', glob } = this.parameters.parse(args);

    try {
      // Validate the regex pattern before passing to ripgrep
      const patternValidation = validateGrepPattern(pattern);
      if (!patternValidation.valid) {
        return { success: false, error: `Invalid grep pattern: ${(patternValidation as { valid: false; error: string }).error}` };
      }

      const validated = await validatePath(searchPath);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      const rgArgs = [
        '--line-number',
        '--color=never',
        '--no-heading',
      ];

      if (glob) {
        rgArgs.push('--glob', glob);
      }

      // FIX CODE-003: Use '--' separator to prevent patterns starting with '-' from being misinterpreted as flags
      rgArgs.push('--', pattern, validated.resolvedPath!);

      const grepArgs = ['-R', '-n'];
      if (glob) {
        grepArgs.push('--include', glob);
      }
      grepArgs.push('--', pattern, validated.resolvedPath!);

      // FIX CODE-001/002: Consolidated state object to prevent race conditions and resource leaks
      return new Promise((resolve) => {
        const state = {
          resolved: false,
          activeProcess: null as ChildProcess | null,
        };

        const finish = (result: ToolResult) => {
          if (state.resolved) return;
          state.resolved = true;
          state.activeProcess = null;
          resolve(result);
        };

        const runSearch = (command: string, args: string[], tool: 'rg' | 'grep') => {
          const proc = spawn(command, args, { cwd: process.cwd() });
          state.activeProcess = proc;  // Track active process
          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', (data) => { stdout += data; });
          proc.stderr.on('data', (data) => { stderr += data; });

          proc.on('close', (code) => {
            if (state.activeProcess !== proc) return;  // Ignore stale events
            const prefix = tool === 'grep' ? 'Using grep fallback (rg not found).\n' : '';
            if (code === 0) {
              finish({ success: true, output: prefix + (stdout || 'No matches found.') });
            } else if (code === 1) {
              finish({ success: true, output: prefix + 'No matches found.' });
            } else {
              finish({ success: false, error: prefix + (stderr || 'Search failed') });
            }
          });

          proc.on('error', (err) => {
            if (state.activeProcess !== proc) return;  // Ignore stale events

            if (tool === 'rg' && (err as NodeJS.ErrnoException).code === 'ENOENT') {
              // Use setImmediate to properly sequence the fallback.
              setImmediate(() => runSearch('grep', grepArgs, 'grep'));
              return;
            }

            // FIX CODE-004: Helpful error when both tools missing
            if (tool === 'grep' && (err as NodeJS.ErrnoException).code === 'ENOENT') {
              finish({
                success: false,
                error: 'Neither ripgrep (rg) nor grep is installed.\n\n' +
                  'Install ripgrep for best results:\n' +
                  '  - macOS: brew install ripgrep\n' +
                  '  - Ubuntu/Debian: apt install ripgrep\n' +
                  '  - Windows: choco install ripgrep\n' +
                  '  - Or visit: https://github.com/BurntSushi/ripgrep#installation',
              });
              return;
            }

            const prefix = tool === 'grep' ? 'Using grep fallback (rg not found).\n' : '';
            finish({ success: false, error: prefix + (err.message || 'Search failed') });
          });
        };

        runSearch('rg', rgArgs, 'rg');
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }
}
