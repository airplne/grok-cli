/**
 * Subagent Definition Types
 *
 * Defines the structure for subagent configuration loaded from
 * .grok/agents/*.md or ~/.grok/agents/*.md files.
 */

/**
 * Subagent definition parsed from a markdown file with YAML frontmatter.
 *
 * Example file format:
 * ```markdown
 * ---
 * name: explore
 * description: Fast codebase exploration specialist
 * tools:
 *   - Read
 *   - Grep
 *   - Glob
 * model: grok-3-mini-fast-beta
 * maxRounds: 20
 * ---
 *
 * You are a fast codebase exploration specialist...
 * ```
 */
export interface SubagentDefinition {
  /** Unique name of the subagent (e.g., "explore", "code-reviewer") */
  name: string;

  /** Human-readable description of what this subagent does */
  description: string;

  /** List of tool names this subagent is allowed to use */
  tools: string[];

  /** Model to use for this subagent (e.g., "grok-3-mini-fast-beta") */
  model: string;

  /** Maximum number of agent loop iterations */
  maxRounds: number;

  /** System prompt for the subagent (the markdown body after frontmatter) */
  systemPrompt: string;
}

/**
 * Single tool execution record for trace
 */
export interface SubagentToolTrace {
  /** Tool name (e.g., "Read", "Grep", "Glob") */
  tool: string;
  /** Key arguments summary (e.g., file path, pattern) */
  argsSummary: string;
  /** Whether the tool call succeeded */
  success: boolean;
  /** Truncated output/result (max 200 chars) */
  resultPreview: string;
}

/**
 * Result from running a subagent
 */
export interface SubagentResult {
  /** Whether the subagent completed successfully */
  success: boolean;

  /** Aggregated text output from the subagent */
  output: string;

  /** Error message if success is false */
  error?: string;

  /** Unique ID for this subagent execution */
  agentId: string;

  /** Evidence from the subagent's tool execution */
  evidence?: SubagentEvidence;

  /** Tool execution trace for auditability */
  trace?: SubagentToolTrace[];
}

/**
 * Evidence summary from a subagent's execution
 */
export interface SubagentEvidence {
  /** Count of each tool used */
  toolCounts: Record<string, number>;

  /** Total number of tool calls */
  totalCalls: number;

  /** Human-readable summary */
  summary: string;
}

/**
 * Alias mappings for common subagent names.
 * Users can use these shortcuts instead of full names.
 */
export const SUBAGENT_ALIASES: Record<string, string> = {
  // explore aliases
  'grok': 'explore',
  'search': 'explore',
  'find': 'explore',
  'lookup': 'explore',

  // code-reviewer aliases
  'review': 'code-reviewer',
  'reviewer': 'code-reviewer',
  'code-review': 'code-reviewer',

  // test-writer aliases
  'test': 'test-writer',
  'tests': 'test-writer',
  'testing': 'test-writer',
};
