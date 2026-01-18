/**
 * Subagent Runner
 *
 * Executes subagents in isolated context and returns aggregated output.
 * Subagents run with restricted tool sets based on their definition.
 */

import { GrokAgent, AgentEvent, ToolCallEvidence } from '../agent/grok-agent.js';
import { loadSubagentDefinition } from './subagent-loader.js';
import { SubagentResult, SubagentEvidence, SubagentToolTrace } from './types.js';

/**
 * Options for running a subagent
 */
export interface SubagentOptions {
  /** API key for Grok API (required) */
  apiKey: string;

  /** Working directory */
  cwd?: string;

  /** Override the model from the definition */
  modelOverride?: string;

  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
}

/**
 * Generate a unique subagent execution ID
 */
function generateAgentId(): string {
  return `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Truncate a string to max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Extract key arguments from tool call for trace summary
 */
function extractArgsSummary(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case 'Read':
      return truncate(String(args.file_path || args.path || ''), 80);
    case 'Grep':
      const pattern = args.pattern ? `"${args.pattern}"` : '';
      const path = args.path ? ` in ${args.path}` : '';
      return truncate(`${pattern}${path}`, 80);
    case 'Glob':
      return truncate(String(args.pattern || ''), 80);
    case 'Write':
    case 'Edit':
      return truncate(String(args.file_path || args.path || ''), 80);
    case 'Bash':
      return truncate(String(args.command || ''), 80);
    default:
      // Generic: show first string arg
      const firstArg = Object.values(args).find(v => typeof v === 'string');
      return truncate(String(firstArg || JSON.stringify(args)), 80);
  }
}

/**
 * Extract result preview from tool result
 */
function extractResultPreview(result: unknown): string {
  if (!result) return '';

  const resultObj = result as { success?: boolean; output?: string; error?: string; data?: unknown };

  if (resultObj.error) {
    return truncate(`ERROR: ${resultObj.error}`, 200);
  }

  if (resultObj.output) {
    return truncate(resultObj.output, 200);
  }

  if (resultObj.data) {
    return truncate(JSON.stringify(resultObj.data), 200);
  }

  return truncate(JSON.stringify(result), 200);
}

/**
 * Format trace as readable string for Task output
 */
function formatTraceSection(trace: SubagentToolTrace[]): string {
  if (trace.length === 0) return '';

  const lines = [
    '',
    '=== SUBAGENT TRACE ===',
    `Tool calls: ${trace.length}`,
    '',
  ];

  for (let i = 0; i < trace.length; i++) {
    const t = trace[i];
    const status = t.success ? '✓' : '✗';
    lines.push(`[${i + 1}] ${status} ${t.tool}: ${t.argsSummary}`);
    if (t.resultPreview) {
      // Indent preview lines
      const previewLines = t.resultPreview.split('\n').slice(0, 3);
      for (const line of previewLines) {
        lines.push(`    ${truncate(line, 150)}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Run a subagent to completion and return the aggregated output.
 *
 * @param subagentType - Name of the subagent definition to load
 * @param prompt - The task prompt for the subagent
 * @param options - Configuration options
 * @returns SubagentResult with success status, output, evidence, and trace
 */
export async function runSubagent(
  subagentType: string,
  prompt: string,
  options: SubagentOptions
): Promise<SubagentResult> {
  const agentId = generateAgentId();
  const timeout = options.timeout || 300000; // 5 minutes default
  const cwd = options.cwd || process.cwd();

  // Validate API key
  if (!options.apiKey) {
    return {
      success: false,
      output: '',
      error: 'AI disabled (offline mode). Cannot run subagents without API key.',
      agentId,
      subagentType,
      allowedTools: [],
    };
  }

  // Load subagent definition
  let definition;
  try {
    definition = await loadSubagentDefinition(subagentType, cwd);
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : `Failed to load subagent "${subagentType}"`,
      agentId,
      subagentType,
      allowedTools: [],
    };
  }

  // Create agent instance with subagent configuration
  const agent = new GrokAgent({
    model: options.modelOverride || definition.model,
    apiKey: options.apiKey,
    maxRounds: definition.maxRounds,
    cwd,
    // Subagent-specific options
    allowedTools: definition.tools,
    customSystemPrompt: definition.systemPrompt,
    isSubagent: true, // Disables TRUTHFULNESS_RULES and context loading
  });

  // Execute with timeout
  const outputChunks: string[] = [];
  let evidence: SubagentEvidence | undefined;
  const trace: SubagentToolTrace[] = [];

  // Track pending tool calls by callId for deterministic correlation
  const pendingByCallId: Map<string, { tool: string; args: unknown; traceIndex: number }> = new Map();

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Subagent timeout exceeded')), timeout)
    );

    // Create execution promise
    const executionPromise = (async () => {
      for await (const event of agent.run(prompt)) {
        switch (event.type) {
          case 'text':
            if (event.content) {
              outputChunks.push(event.content);
            }
            break;

          case 'tool_start':
            // Create trace entry and track by callId
            if (event.tool && event.callId) {
              const traceIndex = trace.length;
              pendingByCallId.set(event.callId, {
                tool: event.tool,
                args: event.args || {},
                traceIndex,
              });

              // Create placeholder trace entry
              trace.push({
                tool: event.tool,
                argsSummary: extractArgsSummary(event.tool, event.args as Record<string, unknown> || {}),
                success: false, // Will be updated on tool_result
                resultPreview: '',
              });
            }
            break;

          case 'tool_result':
            // Update trace entry with result
            if (event.callId && pendingByCallId.has(event.callId)) {
              const pending = pendingByCallId.get(event.callId)!;
              const resultObj = event.result as { success?: boolean } | undefined;
              const success = resultObj?.success !== false;

              // Update the placeholder trace entry
              trace[pending.traceIndex] = {
                tool: pending.tool,
                argsSummary: extractArgsSummary(pending.tool, pending.args as Record<string, unknown>),
                success,
                resultPreview: extractResultPreview(event.result),
              };

              pendingByCallId.delete(event.callId);
            } else if (event.tool) {
              // Fallback for events without callId (shouldn't happen, but handle gracefully)
              trace.push({
                tool: event.tool,
                argsSummary: '(no args - callId missing)',
                success: (event.result as any)?.success !== false,
                resultPreview: extractResultPreview(event.result),
              });
            }
            break;

          case 'evidence':
            // Capture evidence from subagent
            if (event.evidence) {
              evidence = {
                toolCounts: event.evidence.toolCounts,
                totalCalls: event.evidence.totalCalls,
                summary: event.evidence.summary,
              };
            }
            break;

          case 'error':
            throw new Error(event.error || 'Subagent execution failed');

          case 'done':
            return; // Exit normally

          default:
            break;
        }
      }
    })();

    // Race between execution and timeout
    await Promise.race([executionPromise, timeoutPromise]);

    // Build output with trace section
    let output = outputChunks.join('');
    if (trace.length > 0) {
      output += formatTraceSection(trace);
    }

    return {
      success: true,
      output,
      agentId,
      subagentType,
      allowedTools: definition.tools,
      evidence,
      trace,
    };
  } catch (error) {
    // Build output with trace section even on error
    let output = outputChunks.join('');
    if (trace.length > 0) {
      output += formatTraceSection(trace);
    }

    return {
      success: false,
      output,
      error: error instanceof Error ? error.message : 'Subagent execution failed',
      agentId,
      subagentType,
      allowedTools: definition.tools,
      evidence,
      trace,
    };
  }
}
