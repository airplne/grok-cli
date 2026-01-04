import { z } from 'zod';
import { spawn } from 'child_process';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

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

      // Use resolved path for grep search
      rgArgs.push(pattern, validated.resolvedPath!);

      return new Promise((resolve) => {
        const rg = spawn('rg', rgArgs, { cwd: process.cwd() });
        let stdout = '';
        let stderr = '';

        rg.stdout.on('data', (data) => { stdout += data; });
        rg.stderr.on('data', (data) => { stderr += data; });

        rg.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, output: stdout || 'No matches found.' });
          } else if (code === 1) {
            resolve({ success: true, output: 'No matches found.' });
          } else {
            resolve({ success: false, error: stderr || 'Search failed' });
          }
        });

        rg.on('error', (err) => {
          // ripgrep not installed, fall back to grep
          resolve({ success: false, error: 'ripgrep (rg) not found. Install with: brew install ripgrep' });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }
}
