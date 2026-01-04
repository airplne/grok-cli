import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, ToolResult } from './base-tool.js';
import { isCommandAllowed } from '../security/command-allowlist.js';

const execAsync = promisify(exec);

export class BashTool extends BaseTool {
  name = 'Bash';
  description = 'Execute a shell command. Use for git, npm, and other CLI operations.';
  requiresConfirmation = true; // Requires user confirmation

  parameters = z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { command, timeout = 30000 } = this.parameters.parse(args);

    try {
      // Security: Check command allowlist
      const allowed = isCommandAllowed(command);
      if (!allowed.valid) {
        return { success: false, error: allowed.error };
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
        cwd: process.cwd(),
      });

      let output = stdout;
      if (stderr) {
        output += `\n[STDERR]\n${stderr}`;
      }

      return { success: true, output };
    } catch (error: any) {
      const errorMessage = error.stderr || error.message || 'Command failed';
      return {
        success: false,
        error: errorMessage,
        output: error.stdout,
      };
    }
  }
}
