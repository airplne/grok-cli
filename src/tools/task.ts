/**
 * Task Tool
 *
 * Delegates tasks to specialized subagents loaded from .grok/agents/*.md.
 * This enables real subagent execution with verifiable evidence.
 */

import { z } from 'zod';
import { BaseTool, ToolResult, ToolContext } from './base-tool.js';
import { runSubagent } from '../agents/subagent-runner.js';
import { listAvailableSubagents, resolveSubagentName } from '../agents/subagent-loader.js';
import { SUBAGENT_ALIASES, SubagentResult } from '../agents/types.js';

/**
 * Format subagent run header for Task output.
 * Makes it unambiguous that a real subagent was spawned.
 */
function formatSubagentRunHeader(result: SubagentResult): string {
  const toolList = result.allowedTools.join(', ');
  return [
    '=== SUBAGENT RUN (system) ===',
    `subagent_type: ${result.subagentType}`,
    `agentId: ${result.agentId}`,
    `allowedTools: ${toolList}`,
    `note: subagent evidence shows "Subagents spawned: 0" because subagents cannot spawn subagents`,
    '',
  ].join('\n');
}

export class TaskTool extends BaseTool {
  name = 'Task';

  description = `Delegate a task to a specialized subagent. Available subagent types:
- explore: Fast codebase exploration (aliases: grok, search, find)
- code-reviewer: Expert code review (aliases: review, reviewer)
- test-writer: Test generation expert (aliases: test, tests)

Use this tool to spawn subagents for complex, multi-step operations.
Each subagent has a restricted tool set and specialized system prompt.`;

  parameters = z.object({
    subagent_type: z.string().describe(
      'Name or alias of the subagent to invoke (e.g., "explore", "review", "test")'
    ),
    prompt: z.string().describe(
      'The task prompt describing what the subagent should do'
    ),
    model: z.string().optional().describe(
      'Optional model override (defaults to subagent definition model)'
    ),
  });

  // Task tool doesn't require confirmation - it's orchestration/analysis
  requiresConfirmation = false;

  async execute(
    args: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolResult> {
    const parsed = this.parameters.parse(args);
    const { subagent_type, prompt, model } = parsed;

    // Check for API key (required for subagent execution)
    if (!context?.apiKey) {
      return {
        success: false,
        error: 'AI disabled (offline mode). Cannot run subagents without API key. ' +
               'Run "grok auth login" to enable AI features.',
      };
    }

    // Resolve alias and provide helpful error for unknown types
    const resolvedType = resolveSubagentName(subagent_type);

    try {
      // Run the subagent
      const result = await runSubagent(resolvedType, prompt, {
        apiKey: context.apiKey,
        cwd: context.cwd,
        modelOverride: model,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Subagent execution failed',
          output: result.output || undefined,
          data: {
            agentId: result.agentId,
            subagentType: resolvedType,
            evidence: result.evidence,
          },
        };
      }

      // Build output with SUBAGENT RUN header + evidence
      let output = formatSubagentRunHeader(result) + result.output;
      if (result.evidence) {
        output += `\n\n${result.evidence.summary}`;
      }

      return {
        success: true,
        output,
        data: {
          agentId: result.agentId,
          subagentType: resolvedType,
          evidence: result.evidence,
          allowedTools: result.allowedTools,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run subagent',
      };
    }
  }
}

/**
 * Helper to get available subagent types for documentation
 */
export async function getAvailableSubagents(cwd?: string): Promise<string[]> {
  const agents = await listAvailableSubagents(cwd);
  return agents;
}

/**
 * Get the alias mapping for documentation
 */
export function getSubagentAliases(): Record<string, string> {
  return { ...SUBAGENT_ALIASES };
}
