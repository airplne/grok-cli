import { z } from 'zod';
import { promises as fs } from 'fs';
import { BaseTool, ToolResult } from './base-tool.js';
import { validatePath } from '../security/path-validator.js';

export class EditTool extends BaseTool {
  name = 'Edit';
  description = 'Replace a specific string in a file with new content.';
  requiresConfirmation = true; // Requires user confirmation

  parameters = z.object({
    file_path: z.string().describe('The absolute path to the file to edit'),
    old_string: z.string().describe('The exact string to find and replace'),
    new_string: z.string().describe('The string to replace it with'),
    replace_all: z.boolean().optional().describe('Replace all occurrences (default: false)'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, old_string, new_string, replace_all = false } = this.parameters.parse(args);

    try {
      const validated = await validatePath(file_path, { operation: 'write' });
      if (!validated.valid) {
        return { success: false, error: validated.error };
      }

      // Use resolved path for reading and writing
      const targetPath = validated.resolvedPath!;
      const content = await fs.readFile(targetPath, 'utf-8');

      if (!content.includes(old_string)) {
        return {
          success: false,
          error: `String "${old_string.slice(0, 50)}..." not found in file`,
        };
      }

      // Count occurrences
      const occurrences = content.split(old_string).length - 1;

      if (occurrences > 1 && !replace_all) {
        return {
          success: false,
          error: `Found ${occurrences} occurrences. Use replace_all=true to replace all, or provide more context to make the string unique.`,
        };
      }

      const newContent = replace_all
        ? content.replaceAll(old_string, new_string)
        : content.replace(old_string, new_string);

      await fs.writeFile(targetPath, newContent, 'utf-8');

      return {
        success: true,
        output: `Replaced ${replace_all ? occurrences : 1} occurrence(s) in ${file_path}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit file',
      };
    }
  }
}
