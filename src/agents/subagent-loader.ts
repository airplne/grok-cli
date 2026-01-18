/**
 * Subagent Definition Loader
 *
 * Loads subagent definitions from .grok/agents/ directories.
 * Supports YAML frontmatter in markdown files.
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { SubagentDefinition, SUBAGENT_ALIASES } from './types.js';
import { isKnownToolName, KNOWN_TOOL_NAMES } from '../tools/tool-names.js';

/**
 * Zod schema for validating subagent definition frontmatter
 */
const SubagentFrontmatterSchema = z.object({
  name: z.string().min(1, 'Subagent name is required'),
  description: z.string().optional().default(''),
  tools: z.array(z.string()).min(1, 'At least one tool must be specified'),
  model: z.string().min(1, 'Model is required'),
  maxRounds: z.number().int().positive().default(30),
});

/**
 * Parse simple YAML frontmatter from markdown content.
 * Handles basic types: strings, numbers, arrays of strings.
 *
 * @param content - Full markdown content with frontmatter
 * @returns Parsed frontmatter object and body content
 */
function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid frontmatter format: must start with --- and end with ---');
  }

  const [, yamlContent, body] = match;
  const data: Record<string, unknown> = {};

  // Parse YAML line by line
  const lines = yamlContent.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const rawLine of lines) {
    if (rawLine.includes('\t')) {
      throw new Error('Invalid frontmatter: tabs are not supported');
    }

    const trimmed = rawLine.trim();
    const isIndented = rawLine.startsWith(' ') || rawLine.startsWith('\t');

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Array mode: consume "- item" lines until we hit the next top-level key
    if (currentKey && currentArray !== null) {
      if (trimmed.startsWith('- ')) {
        const item = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
        if (!item) {
          throw new Error(`Invalid frontmatter: empty array item under "${currentKey}"`);
        }
        currentArray.push(item);
        continue;
      }

      if (isIndented) {
        throw new Error(
          `Invalid frontmatter: nested mappings are not supported (unexpected indentation under "${currentKey}")`
        );
      }

      // End of array - commit and fall through to parse a new key
      data[currentKey] = currentArray;
      currentKey = null;
      currentArray = null;
    }

    // Disallow nested mappings/indentation (we only support simple key/value + arrays)
    if (isIndented) {
      throw new Error('Invalid frontmatter: nested mappings are not supported');
    }

    // Disallow array items without a parent key
    if (trimmed.startsWith('- ')) {
      throw new Error('Invalid frontmatter: array item without a key');
    }

    // Parse key: value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      currentKey = key;

      if (value === '') {
        // Start of an array
        currentArray = [];
      } else {
        if (value === '|' || value === '>') {
          throw new Error(`Invalid frontmatter: multiline values are not supported for "${key}"`);
        }

        // Inline arrays: tools: [Read, Grep, Glob]
        if (value.startsWith('[') && value.endsWith(']')) {
          const inner = value.slice(1, -1).trim();
          const items = inner
            ? inner.split(',').map(item => item.trim()).filter(Boolean)
            : [];
          data[key] = items.map(item => item.replace(/^["']|["']$/g, ''));
          continue;
        }

        // Simple value - detect type
        if (value === 'true') {
          data[key] = true;
        } else if (value === 'false') {
          data[key] = false;
        } else if (/^\d+$/.test(value)) {
          data[key] = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          data[key] = parseFloat(value);
        } else {
          // Remove surrounding quotes if present
          data[key] = value.replace(/^["']|["']$/g, '');
        }
      }
      continue;
    }

    throw new Error(`Invalid frontmatter: expected "key: value" but got "${trimmed}"`);
  }

  // Save final array if pending
  if (currentKey && currentArray !== null) {
    data[currentKey] = currentArray;
  }

  return { data, body: body.trim() };
}

/**
 * Resolve subagent name through aliases.
 *
 * @param name - User-provided name (may be an alias)
 * @returns Resolved subagent name
 */
export function resolveSubagentName(name: string): string {
  const normalized = name.toLowerCase().trim();
  return SUBAGENT_ALIASES[normalized] || normalized;
}

/**
 * Load a subagent definition by name.
 * Searches in project (.grok/agents/) then user (~/.grok/agents/) directories.
 *
 * @param name - Subagent name or alias
 * @param cwd - Working directory for project-relative search
 * @returns SubagentDefinition if found
 * @throws Error if not found or invalid
 */
export async function loadSubagentDefinition(
  name: string,
  cwd: string = process.cwd()
): Promise<SubagentDefinition> {
  const resolvedName = resolveSubagentName(name);

  // Search paths in priority order
  const homeDir = os.homedir();
  const searchPaths = [
    path.join(cwd, '.grok', 'agents', `${resolvedName}.md`),
    path.join(homeDir, '.grok', 'agents', `${resolvedName}.md`),
  ];

  let lastError: Error | null = null;

  for (const filePath of searchPaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data, body } = parseFrontmatter(content);

      // Validate with zod
      const validated = SubagentFrontmatterSchema.parse(data);
      const tools = validated.tools.map(tool => tool.trim()).filter(Boolean);
      if (tools.length === 0) {
        throw new Error('At least one tool must be specified');
      }
      const invalidTools = tools.filter(tool => !isKnownToolName(tool));
      if (invalidTools.length > 0) {
        throw new Error(
          `Invalid tool name(s) in subagent "${validated.name}": ${invalidTools.join(', ')}. ` +
          `Allowed: ${KNOWN_TOOL_NAMES.join(', ')}`
        );
      }

      return {
        name: validated.name,
        description: validated.description,
        tools,
        model: validated.model,
        maxRounds: validated.maxRounds,
        systemPrompt: body,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // File not found, try next path
        continue;
      }
      // Validation or parsing error
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // No definition found
  const searchedPaths = searchPaths.join(', ');
  if (lastError) {
    throw new Error(
      `Failed to load subagent "${name}" (resolved to "${resolvedName}"): ${lastError.message}`
    );
  }
  throw new Error(
    `Subagent "${name}" not found. Searched: ${searchedPaths}\n` +
    `Available aliases: ${Object.keys(SUBAGENT_ALIASES).join(', ')}`
  );
}

/**
 * List all available subagent names from both project and user directories.
 *
 * @param cwd - Working directory for project-relative search
 * @returns Array of subagent names
 */
export async function listAvailableSubagents(cwd: string = process.cwd()): Promise<string[]> {
  const agents = new Set<string>();

  const homeDir = os.homedir();
  const searchDirs = [
    path.join(cwd, '.grok', 'agents'),
    path.join(homeDir, '.grok', 'agents'),
  ];

  for (const dir of searchDirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          agents.add(file.replace(/\.md$/, ''));
        }
      }
    } catch {
      // Directory doesn't exist, skip
      continue;
    }
  }

  return Array.from(agents).sort();
}
