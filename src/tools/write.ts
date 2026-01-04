import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class WriteTool extends BaseTool {
  name = 'Write';
  description = 'Write content to a file. Creates the file if it does not exist.';
  requiresConfirmation = true; // Requires user confirmation

  parameters = z.object({
    file_path: z.string().describe('The absolute path to the file to write'),
    content: z.string().describe('The content to write to the file'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, content } = this.parameters.parse(args);

    try {
      // Validate with allowNonExistent for write operations
      const validated = await validatePath(file_path, {
        allowNonExistent: true,
        operation: 'write',
      });
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      // Use the resolved path for writing
      const targetPath = validated.resolvedPath!;

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      await fs.writeFile(targetPath, content, 'utf-8');

      return {
        success: true,
        output: `Successfully wrote ${content.length} bytes to ${file_path}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file',
      };
    }
  }
}
