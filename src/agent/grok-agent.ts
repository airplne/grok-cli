import OpenAI from 'openai';
import { GrokClient } from '../client/grok-client.js';
import { tools, getTool, getToolDefinitions, ToolContext } from '../tools/index.js';
import { loadContext } from '../context/context-loader.js';
import { requiresConfirmation, ConfirmationHandler } from '../security/permission-manager.js';

/**
 * Truthfulness rules to ensure accurate claims about tool and subagent usage.
 * Injected into the system prompt.
 */
const TRUTHFULNESS_RULES = `
## CRITICAL: Tool Truthfulness Rules

You MUST follow these rules EXACTLY:

1. **Only claim subagent execution if the Task tool was actually called AND succeeded.**
   - Use the Task tool to spawn subagents (explore, code-reviewer, test-writer).
   - If Task was not called, you did NOT spawn subagents.

2. **When user asks for subagents:**
   - Use the Task tool with the appropriate subagent_type (e.g., "explore", "review", "test").
   - If offline/no API key: Task will fail and you should report "Subagents unavailable in offline mode."

3. **NEVER use misleading phrases** like:
   - "Subagent Team Spun Up" (unless Task tool actually succeeded)
   - "Investigation & Testing Complete" (unless tests actually ran via Bash or Task)
   - "Spinning up X subagents" (unless X Task calls were made)

4. **Be truthful about what you did:**
   - Only claim to have read files if you used Read tool
   - Only claim to have searched if you used Grep or Glob
   - Only claim tests ran if you executed them via Bash
   - Only claim subagents ran if Task tool calls succeeded

5. **Available tools:** Read, Write, Edit, Bash, Glob, Grep, TodoWrite, Task
   - Task: Spawn subagents (explore, code-reviewer, test-writer)

6. **NEVER fabricate evidence blocks.**
   - The system automatically prints a verified "=== EVIDENCE ===" block (labeled "Evidence (system-verified)") showing actual tool/subagent usage.
   - Do NOT invent, paste, or summarize your own "evidence" block in your response.
   - Do NOT write text like "FINAL main-agent evidence block" or similar.
   - If the user asks about evidence, tell them to look for the magenta "Evidence (system-verified)" box printed by the system.
   - The system evidence appears BEFORE your final response; this is by design.

7. **NEVER claim to paste "FULL tool output verbatim".**
   - Do NOT use phrases like:
     - "FULL Task tool output (verbatim)"
     - "paste the full tool output here"
     - "here is the complete raw output"
   - Tool outputs are shown in expandable [Tool] boxes in the TUI.
   - If the user asks for full output, instruct them to:
     - Use ↑/↓ arrow keys to select the [Task] tool output
     - Press 'e' to expand and see the full output
     - Press 'e' again to collapse, or Esc to return to input
   - The subagent trace (=== SUBAGENT TRACE ===) shows what tools the subagent actually used.
`;

export interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_result' | 'error' | 'done' | 'evidence';
  content?: string;
  tool?: string;
  result?: unknown;
  error?: string;
  evidence?: ToolCallEvidence;
  /** Tool call ID for correlation (present on tool_start and tool_result) */
  callId?: string;
  /** Parsed tool arguments (present on tool_start and tool_result) */
  args?: unknown;
}

export interface ToolCallRecord {
  tool: string;
  timestamp: number;
  success: boolean;
  callId: string;
}

export interface ToolCallEvidence {
  toolCounts: Record<string, number>;
  totalCalls: number;
  subagentsSpawned: number;
  summary: string;
}

/**
 * Compute evidence summary from tool call log.
 *
 * @param toolCallLog - Array of tool call records
 * @param isSubagent - Whether this is a subagent (affects wording)
 * @returns Evidence summary with tool counts and human-readable summary
 */
export function computeToolCallEvidence(
  toolCallLog: ToolCallRecord[],
  isSubagent: boolean = false
): ToolCallEvidence {
  const toolCounts: Record<string, number> = {};
  let taskAttempts = 0;
  let taskSuccesses = 0;

  for (const call of toolCallLog) {
    toolCounts[call.tool] = (toolCounts[call.tool] || 0) + 1;

    if (call.tool === 'Task') {
      taskAttempts += 1;
      if (call.success) {
        taskSuccesses += 1;
      }
    }
  }

  const totalCalls = toolCallLog.length;
  const subagentsSpawned = taskSuccesses;

  const toolList = Object.entries(toolCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tool, count]) => `${tool}(${count})`)
    .join(', ');

  // Clarified wording based on agent type
  let subagentLine: string;
  if (isSubagent) {
    // Subagents can't spawn subagents (no Task tool)
    subagentLine = 'Subagents spawned: 0 (subagents cannot spawn subagents)';
  } else {
    // Main agent: clarify this counts successful Task calls
    const taskSuffix = taskAttempts > 0 ? ` (Task ${taskSuccesses}/${taskAttempts} succeeded)` : '';
    subagentLine = `Subagents spawned (via Task): ${subagentsSpawned}${taskSuffix}`;
  }

  const summary = [
    '=== EVIDENCE ===',
    `Tools executed: ${toolList || 'none'}`,
    `Total tool calls: ${totalCalls}`,
    subagentLine,
  ].join('\n');

  return { toolCounts, totalCalls, subagentsSpawned, summary };
}

export interface AgentOptions {
  model?: string;
  apiKey?: string;  // API key from keychain
  maxRounds?: number;
  cwd?: string;

  // Subagent-specific options
  /** Restrict available tools to this list (for subagents) */
  allowedTools?: string[];
  /** Use a custom system prompt instead of loading GROK.md context */
  customSystemPrompt?: string;
  /** If true, skip truthfulness rules and context loading (for subagents) */
  isSubagent?: boolean;
}

type Message = OpenAI.Chat.ChatCompletionMessageParam;
type ToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

export class GrokAgent {
  private client: GrokClient;
  private messages: Message[] = [];
  private maxRounds: number;
  private cwd: string;
  private apiKey?: string;
  private toolCallLog: ToolCallRecord[] = [];

  // Subagent-specific options
  private allowedTools?: string[];
  private customSystemPrompt?: string;
  private isSubagent: boolean;

  constructor(options: AgentOptions = {}) {
    this.client = new GrokClient({
      model: options.model,
      apiKey: options.apiKey  // Pass keychain API key to GrokClient
    });
    this.maxRounds = options.maxRounds || 100;
    this.cwd = options.cwd || process.cwd();
    this.apiKey = options.apiKey;

    // Subagent options
    this.allowedTools = options.allowedTools;
    this.customSystemPrompt = options.customSystemPrompt;
    this.isSubagent = options.isSubagent || false;
  }

  /**
   * Get evidence summary of all tool calls made during this session.
   * This provides verifiable proof of what actually happened.
   */
  getEvidenceSummary(): ToolCallEvidence {
    return computeToolCallEvidence(this.toolCallLog, this.isSubagent);
  }

  /**
   * Get the current model ID
   */
  get model(): string {
    return this.client.model;
  }

  /**
   * Run the agent with a prompt
   * @param prompt - User's input prompt
   * @param onConfirmation - Optional callback for permission requests (for Ink UI)
   */
  async *run(
    prompt: string,
    onConfirmation?: ConfirmationHandler
  ): AsyncGenerator<AgentEvent> {
    try {
      // Initialize messages and reset tool call log
      this.messages = [];
      this.toolCallLog = [];

      // Build system prompt based on whether this is a subagent or main agent
      let systemPrompt: string;

      if (this.isSubagent) {
        // Subagents never load GROK.md context or TRUTHFULNESS_RULES.
        const promptOverride = this.customSystemPrompt?.trim();
        systemPrompt = promptOverride || 'You are a subagent. Follow the user instructions.';
      } else {
        // Main agent: Load context from GROK.md files and add truthfulness rules
        const context = await loadContext(this.cwd);
        const basePrompt = 'You are Grok, an AI coding assistant. Help the user with their coding tasks.';
        const contextSection = context ? `\n\n${context}` : '';
        systemPrompt = `${basePrompt}${contextSection}\n\n${TRUTHFULNESS_RULES}`;
      }

      this.messages.push({
        role: 'system',
        content: systemPrompt,
      });

      this.messages.push({ role: 'user', content: prompt });

      // Agent loop
      for (let round = 0; round < this.maxRounds; round++) {
        const stream = await this.client.openai.chat.completions.create({
          model: this.client.model,
          messages: this.messages,
          tools: getToolDefinitions(this.allowedTools),
          stream: true,
        });

        let responseContent = '';
        let toolCalls: ToolCall[] = [];

        // Process stream
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            responseContent += delta.content;
            yield { type: 'text', content: delta.content };
          }

          if (delta?.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index;

              if (!toolCalls[index]) {
                toolCalls[index] = {
                  id: toolCallDelta.id || '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }

              if (toolCallDelta.id) {
                toolCalls[index].id = toolCallDelta.id;
              }
              if (toolCallDelta.function?.name) {
                toolCalls[index].function.name += toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                toolCalls[index].function.arguments += toolCallDelta.function.arguments;
              }
            }
          }
        }

        // Filter out empty tool calls
        toolCalls = toolCalls.filter(tc => tc.id && tc.function.name);

        // If there are tool calls, execute them
        if (toolCalls.length > 0) {
          this.messages.push({
            role: 'assistant',
            content: responseContent || null,
            tool_calls: toolCalls,
          });

          for (const toolCall of toolCalls) {
            const args = JSON.parse(toolCall.function.arguments);

            yield {
              type: 'tool_start',
              tool: toolCall.function.name,
              callId: toolCall.id,
              args,
            };

            try {
              const tool = getTool(toolCall.function.name, this.allowedTools);

              if (!tool) {
                const errorMsg = this.allowedTools
                  ? `Tool "${toolCall.function.name}" not available (allowed: ${this.allowedTools.join(', ')})`
                  : `Unknown tool: ${toolCall.function.name}`;
                const errorResult = { success: false, error: errorMsg };
                yield {
                  type: 'tool_result',
                  tool: toolCall.function.name,
                  result: errorResult,
                  callId: toolCall.id,
                  args,
                };
                this.messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(errorResult),
                });
                continue;
              }

              // Check if confirmation is needed
              if (tool.requiresConfirmation || requiresConfirmation(tool.name)) {
                // Use callback if provided (Ink UI), otherwise auto-deny
                const allowed = onConfirmation
                  ? await onConfirmation(tool.name, args)
                  : false;

                if (!allowed) {
                  const deniedResult = { success: false, error: 'User denied permission' };
                  yield {
                    type: 'tool_result',
                    tool: tool.name,
                    result: deniedResult,
                    callId: toolCall.id,
                    args,
                  };
                  this.messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(deniedResult),
                  });
                  continue;
                }
              }

              // Build tool context for tools that need it (e.g., Task tool)
              const toolContext: ToolContext = {
                apiKey: this.apiKey,
                cwd: this.cwd,
              };

              const result = await tool.execute(args, toolContext);
              yield {
                type: 'tool_result',
                tool: tool.name,
                result,
                callId: toolCall.id,
                args,
              };

              // Record successful tool call for evidence
              this.toolCallLog.push({
                tool: tool.name,
                timestamp: Date.now(),
                success: result.success !== false,
                callId: toolCall.id,
              });

              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              const errorResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Tool execution failed',
              };
              yield {
                type: 'tool_result',
                tool: toolCall.function.name,
                result: errorResult,
                callId: toolCall.id,
                args,
              };

              // Record failed tool call for evidence
              this.toolCallLog.push({
                tool: toolCall.function.name,
                timestamp: Date.now(),
                success: false,
                callId: toolCall.id,
              });

              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(errorResult),
              });
            }
          }
        } else {
          // No tool calls - we're done
          this.messages.push({ role: 'assistant', content: responseContent });

          // Emit evidence summary before done
          if (this.toolCallLog.length > 0) {
            yield { type: 'evidence', evidence: this.getEvidenceSummary() };
          }

          yield { type: 'done' };
          return;
        }
      }

      // Emit evidence even on max rounds exceeded
      if (this.toolCallLog.length > 0) {
        yield { type: 'evidence', evidence: this.getEvidenceSummary() };
      }
      yield { type: 'error', error: 'Maximum rounds exceeded' };
    } catch (error) {
      // Emit evidence even on error
      if (this.toolCallLog.length > 0) {
        yield { type: 'evidence', evidence: this.getEvidenceSummary() };
      }
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Agent execution failed',
      };
    }
  }
}
