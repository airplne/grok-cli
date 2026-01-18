import { BaseTool } from './base-tool.js';
import { ReadTool } from './read.js';
import { WriteTool } from './write.js';
import { EditTool } from './edit.js';
import { BashTool } from './bash.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import { TodoTool } from './todo.js';
import { TaskTool } from './task.js';

export const tools: BaseTool[] = [
  new ReadTool(),
  new WriteTool(),
  new EditTool(),
  new BashTool(),
  new GlobTool(),
  new GrepTool(),
  new TodoTool(),
  new TaskTool(),
];

/**
 * Get tool definitions, optionally filtered by allowed tool names.
 *
 * @param allowedTools - If provided, only return definitions for these tools
 * @returns Array of tool definitions
 */
export function getToolDefinitions(allowedTools?: string[]) {
  if (allowedTools && allowedTools.length > 0) {
    const filtered = tools.filter(tool => allowedTools.includes(tool.name));
    return filtered.map(tool => tool.getDefinition());
  }
  return tools.map(tool => tool.getDefinition());
}

/**
 * Get a tool by name, optionally restricted to allowed tools.
 *
 * @param name - Tool name to find
 * @param allowedTools - If provided, only return tool if it's in this list
 * @returns Tool instance or undefined
 */
export function getTool(name: string, allowedTools?: string[]): BaseTool | undefined {
  const tool = tools.find(tool => tool.name === name);
  if (tool && allowedTools && allowedTools.length > 0) {
    return allowedTools.includes(tool.name) ? tool : undefined;
  }
  return tool;
}

export { BaseTool } from './base-tool.js';
export type { ToolResult, ToolDefinition, ToolContext } from './base-tool.js';
export { TodoTool } from './todo.js';
export type { TodoItem } from './todo.js';
