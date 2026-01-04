import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseTool, ToolResult } from './base-tool.js';
import { validateAndOpen } from '../security/path-validator.js';

export class ReadTool extends BaseTool {
  name = 'Read';
  description = 'Read the contents of a file. Returns the file content with line numbers.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    file_path: z.string().describe('The absolute path to the file to read'),
    offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
    limit: z.number().optional().describe('Maximum number of lines to read'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, offset = 1, limit } = this.parameters.parse(args);

    try {
      // Use validateAndOpen for TOCTOU mitigation - atomically validates and opens file
      const result = await validateAndOpen(file_path);
      if (!result.valid || !result.handle) {
        return { success: false, error: result.error };
      }

      try {
        const content = await result.handle.readFile('utf-8');
        const lines = content.split('\n');

        const startLine = Math.max(1, offset) - 1;
        const endLine = limit ? startLine + limit : lines.length;
        const selectedLines = lines.slice(startLine, endLine);

        // Format with line numbers
        const formatted = selectedLines
          .map((line, i) => `${String(startLine + i + 1).padStart(6)}→${line}`)
          .join('\n');

        return { success: true, output: formatted };
      } finally {
        await result.handle.close();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      };
    }
  }
}
