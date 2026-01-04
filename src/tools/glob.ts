import { z } from 'zod';
import fg from 'fast-glob';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class GlobTool extends BaseTool {
  name = 'Glob';
  description = 'Find files matching a glob pattern. Returns list of matching file paths.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    pattern: z.string().describe('The glob pattern to match (e.g., "**/*.ts")'),
    path: z.string().optional().describe('Directory to search in (default: current directory)'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, path: searchPath = process.cwd() } = this.parameters.parse(args);

    try {
      const validated = await validatePath(searchPath);
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      // Use resolved path for glob search
      const files = await fg(pattern, {
        cwd: validated.resolvedPath!,
        ignore: ['**/node_modules/**', '**/.git/**'],
        onlyFiles: true,
        absolute: true,
      });

      if (files.length === 0) {
        return { success: true, output: 'No files found matching pattern.' };
      }

      return {
        success: true,
        output: files.join('\n'),
        data: { count: files.length },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Glob search failed',
      };
    }
  }
}
