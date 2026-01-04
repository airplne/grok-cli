import { BaseTool } from './base-tool.js';
import { ReadTool } from './read.js';
import { WriteTool } from './write.js';
import { EditTool } from './edit.js';
import { BashTool } from './bash.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import { TodoTool } from './todo.js';

export const tools: BaseTool[] = [
  new ReadTool(),
  new WriteTool(),
  new EditTool(),
  new BashTool(),
  new GlobTool(),
  new GrepTool(),
  new TodoTool(),
];

export function getToolDefinitions() {
  return tools.map(tool => tool.getDefinition());
}

export function getTool(name: string): BaseTool | undefined {
  return tools.find(tool => tool.name === name);
}

export { BaseTool } from './base-tool.js';
export type { ToolResult, ToolDefinition } from './base-tool.js';
export { TodoTool } from './todo.js';
export type { TodoItem } from './todo.js';
