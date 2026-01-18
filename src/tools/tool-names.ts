/**
 * Canonical list of tool names.
 *
 * This file intentionally contains no imports to avoid circular dependencies
 * between the tool registry and higher-level features (e.g., subagents).
 *
 * Keep this list in sync with `src/tools/index.ts`.
 */

export const KNOWN_TOOL_NAMES = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'TodoWrite',
  'Task',
] as const;

export type KnownToolName = (typeof KNOWN_TOOL_NAMES)[number];

export function isKnownToolName(name: string): name is KnownToolName {
  return (KNOWN_TOOL_NAMES as readonly string[]).includes(name);
}

