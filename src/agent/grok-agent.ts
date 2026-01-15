import OpenAI from 'openai';
import { GrokClient } from '../client/grok-client.js';
import { tools, getTool, getToolDefinitions } from '../tools/index.js';
import { loadContext } from '../context/context-loader.js';
import { requiresConfirmation, ConfirmationHandler } from '../security/permission-manager.js';

export interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_result' | 'error' | 'done';
  content?: string;
  tool?: string;
  result?: unknown;
  error?: string;
}

export interface AgentOptions {
  model?: string;
  apiKey?: string;  // API key from keychain
  maxRounds?: number;
  cwd?: string;
}

type Message = OpenAI.Chat.ChatCompletionMessageParam;
type ToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

export class GrokAgent {
  private client: GrokClient;
  private messages: Message[] = [];
  private maxRounds: number;
  private cwd: string;

  constructor(options: AgentOptions = {}) {
    this.client = new GrokClient({
      model: options.model,
      apiKey: options.apiKey  // Pass keychain API key to GrokClient
    });
    this.maxRounds = options.maxRounds || 100;
    this.cwd = options.cwd || process.cwd();
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
      // Load context from GROK.md files
      const context = await loadContext(this.cwd);

      // Initialize messages
      this.messages = [];

      if (context) {
        this.messages.push({
          role: 'system',
          content: `You are Grok, an AI coding assistant. Follow the instructions below:\n\n${context}`,
        });
      } else {
        this.messages.push({
          role: 'system',
          content: 'You are Grok, an AI coding assistant. Help the user with their coding tasks.',
        });
      }

      this.messages.push({ role: 'user', content: prompt });

      // Agent loop
      for (let round = 0; round < this.maxRounds; round++) {
        const stream = await this.client.openai.chat.completions.create({
          model: this.client.model,
          messages: this.messages,
          tools: getToolDefinitions(),
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
            yield { type: 'tool_start', tool: toolCall.function.name };

            try {
              const args = JSON.parse(toolCall.function.arguments);
              const tool = getTool(toolCall.function.name);

              if (!tool) {
                const errorResult = { success: false, error: `Unknown tool: ${toolCall.function.name}` };
                yield { type: 'tool_result', tool: toolCall.function.name, result: errorResult };
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
                  yield { type: 'tool_result', tool: tool.name, result: deniedResult };
                  this.messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(deniedResult),
                  });
                  continue;
                }
              }

              const result = await tool.execute(args);
              yield { type: 'tool_result', tool: tool.name, result };

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
              yield { type: 'tool_result', tool: toolCall.function.name, result: errorResult };
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
          yield { type: 'done' };
          return;
        }
      }

      yield { type: 'error', error: 'Maximum rounds exceeded' };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Agent execution failed',
      };
    }
  }
}
