import { z } from 'zod';
import { BaseTool, ToolResult } from './base-tool.js';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// In-memory store (shared across tool invocations)
let currentTodos: TodoItem[] = [];

export class TodoTool extends BaseTool {
  name = 'TodoWrite';
  description = 'Create and manage a structured task list. Use to track progress on multi-step tasks.';
  requiresConfirmation = false; // Auto-approved

  parameters = z.object({
    todos: z.array(z.object({
      content: z.string().describe('Task description in imperative form'),
      status: z.enum(['pending', 'in_progress', 'completed']).describe('Task status'),
      activeForm: z.string().describe('Present continuous form shown during execution'),
    })).describe('The updated todo list'),
  });

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { todos } = this.parameters.parse(args);

    currentTodos = todos;

    const summary = todos.map(t => {
      const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
      return `${icon} ${t.content}`;
    }).join('\n');

    return {
      success: true,
      output: `Todo list updated:\n${summary}`,
      data: { todos },
    };
  }

  static getTodos(): TodoItem[] {
    return currentTodos;
  }
}
