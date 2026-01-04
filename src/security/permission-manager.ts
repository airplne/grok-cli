const AUTO_APPROVED_TOOLS = ['Read', 'Glob', 'Grep', 'WebSearch', 'XSearch', 'TodoWrite'];

export function requiresConfirmation(toolName: string): boolean {
  return !AUTO_APPROVED_TOOLS.includes(toolName);
}

// ConfirmationHandler type for Ink UI integration
export type ConfirmationHandler = (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
