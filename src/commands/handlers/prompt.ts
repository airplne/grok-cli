/**
 * /prompt Command Handler
 *
 * Loads content from a file and submits it as a prompt.
 * Useful for long, multi-line prompts that may get garbled when pasted.
 *
 * SECURITY: Uses path-validator to prevent path traversal and blocked file access.
 */

import path from 'path';
import type { Command, ParsedCommand, CommandContext, CommandResult } from '../types.js';
import { validateAndOpen } from '../../security/path-validator.js';
import { sanitizeControlSequences } from '../utils.js';

// Maximum file size for prompt files: 256KB
const MAX_PROMPT_SIZE = 262144;

export const promptCommand: Command = {
  name: 'prompt',
  description: 'Load a prompt from a file and submit it',
  usage: '/prompt <file_path>',
  arguments: [
    {
      name: 'file_path',
      description: 'Path to the file containing the prompt (relative or absolute)',
      required: true,
      type: 'string',
    },
  ],
  examples: [
    '/prompt ./my-prompt.txt',
    '/prompt /home/user/prompts/test-scenario.md',
    '/prompt prompts/long-test.txt',
  ],
  aliases: ['promptfile', 'pf', 'loadprompt'],

  async execute(parsed: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const filePathRaw = parsed.args[0];

    if (!filePathRaw) {
      return {
        success: false,
        error: 'Missing file path. Usage: /prompt <file_path>\n\n' +
               'Examples:\n' +
               '  /prompt ./my-prompt.txt\n' +
               '  /prompt prompts/test-scenario.md',
      };
    }

    // Belt-and-suspenders: sanitize control sequences from file path
    // Parser already sanitizes, but this ensures no leakage at handler level
    const filePath = sanitizeControlSequences(filePathRaw).trim();

    // Resolve path relative to cwd
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(context.cwd, filePath);

    // Use secure path validation and atomic open
    const result = await validateAndOpen(resolvedPath);

    if (!result.valid || !result.handle) {
      return {
        success: false,
        error: result.error || 'Failed to open file',
      };
    }

    try {
      // Check file size before reading
      const stats = await result.handle.stat();

      if (!stats.isFile()) {
        await result.handle.close();
        return {
          success: false,
          error: `Not a file: ${filePath}`,
        };
      }

      if (stats.size === 0) {
        await result.handle.close();
        return {
          success: false,
          error: `File is empty: ${filePath}`,
        };
      }

      if (stats.size > MAX_PROMPT_SIZE) {
        await result.handle.close();
        return {
          success: false,
          error: `File is too large: ${filePath} (${stats.size} bytes)\n` +
                 `Maximum allowed size: ${MAX_PROMPT_SIZE} bytes (256KB)`,
        };
      }

      // Read file content using the validated handle
      const buffer = Buffer.allocUnsafe(stats.size);
      await result.handle.read(buffer, 0, stats.size, 0);
      await result.handle.close();

      const content = buffer.toString('utf-8').trim();

      if (!content) {
        return {
          success: false,
          error: `File contains only whitespace: ${filePath}`,
        };
      }

      // Return success with submit_prompt action
      const lines = content.split('\n').length;
      const chars = content.length;

      return {
        success: true,
        output: `Loaded prompt from ${path.basename(filePath)} (${lines} lines, ${chars} chars)`,
        action: {
          type: 'submit_prompt',
          content,
        },
      };
    } catch (error) {
      // Ensure handle is closed on error
      try {
        await result.handle.close();
      } catch {
        // Ignore close errors
      }

      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};
