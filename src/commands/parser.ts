/**
 * Command Parser
 *
 * Parses user input to detect and extract slash commands.
 * Handles command detection, argument parsing, and flag extraction.
 */

import type { ParsedCommand, ParseResult } from './types.js';

/**
 * Check if input starts with a slash command
 */
export function isCommand(input: string): boolean {
  const trimmed = input.trim();
  // Must start with / followed by a letter (not //)
  return /^\/[a-zA-Z]/.test(trimmed);
}

/**
 * Parse a command string into structured format
 *
 * Supports:
 * - Positional arguments: /command arg1 arg2
 * - Quoted arguments: /command "arg with spaces"
 * - Named flags: /command --flag=value
 * - Boolean flags: /command --verbose
 *
 * @param input - Raw user input string
 * @returns Parsed command structure
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  // Remove leading slash
  const withoutSlash = trimmed.slice(1);

  // Split into command name and rest
  const firstSpaceIndex = withoutSlash.indexOf(' ');
  const name = firstSpaceIndex === -1
    ? withoutSlash.toLowerCase()
    : withoutSlash.slice(0, firstSpaceIndex).toLowerCase();

  const rawArgs = firstSpaceIndex === -1
    ? ''
    : withoutSlash.slice(firstSpaceIndex + 1).trim();

  // Parse arguments and flags
  const { args, flags } = parseArguments(rawArgs);

  return {
    name,
    rawArgs,
    args,
    flags,
  };
}

/**
 * Parse argument string into positional args and named flags
 */
function parseArguments(rawArgs: string): { args: string[]; flags: Record<string, string | boolean> } {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  if (!rawArgs) {
    return { args, flags };
  }

  // Tokenize respecting quotes
  const tokens = tokenize(rawArgs);

  for (const token of tokens) {
    if (token.startsWith('--')) {
      // Named flag
      const flagContent = token.slice(2);
      const equalsIndex = flagContent.indexOf('=');

      if (equalsIndex === -1) {
        // Boolean flag: --verbose
        flags[flagContent] = true;
      } else {
        // Value flag: --model=grok-4
        const key = flagContent.slice(0, equalsIndex);
        const value = flagContent.slice(equalsIndex + 1);
        flags[key] = value;
      }
    } else if (token.startsWith('-') && token.length === 2) {
      // Short flag: -v (treat as boolean)
      flags[token.slice(1)] = true;
    } else {
      // Positional argument
      args.push(token);
    }
  }

  return { args, flags };
}

/**
 * Tokenize a string respecting quoted sections
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
    } else if (!inQuotes && char === ' ') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse user input and determine if it's a command or regular message
 */
export function parseInput(input: string): ParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'empty' };
  }

  if (isCommand(trimmed)) {
    return { type: 'command', command: parseCommand(trimmed) };
  }

  return { type: 'message', content: trimmed };
}

/**
 * Format a command for display (e.g., in help text)
 */
export function formatCommandSignature(name: string, args: { name: string; required: boolean }[]): string {
  const argParts = args.map(arg =>
    arg.required ? `<${arg.name}>` : `[${arg.name}]`
  );
  return `/${name}${argParts.length > 0 ? ' ' + argParts.join(' ') : ''}`;
}

// ============================================================================
// TESTS - Run with: npx tsx src/commands/parser.ts
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running parser tests...\n');

  const tests = [
    // Basic command detection
    { input: '/help', expected: { name: 'help', args: [], flags: {} } },
    { input: '/model grok-4', expected: { name: 'model', args: ['grok-4'], flags: {} } },
    { input: '  /exit  ', expected: { name: 'exit', args: [], flags: {} } },

    // Not commands
    { input: 'hello', isCommand: false },
    { input: '// comment', isCommand: false },
    { input: '/123', isCommand: false },

    // Arguments
    { input: '/history 20', expected: { name: 'history', args: ['20'], flags: {} } },
    { input: '/model grok-3-beta', expected: { name: 'model', args: ['grok-3-beta'], flags: {} } },

    // Quoted arguments
    { input: '/echo "hello world"', expected: { name: 'echo', args: ['hello world'], flags: {} } },
    { input: "/echo 'single quotes'", expected: { name: 'echo', args: ['single quotes'], flags: {} } },

    // Flags
    { input: '/help --verbose', expected: { name: 'help', args: [], flags: { verbose: true } } },
    { input: '/model --set=grok-4', expected: { name: 'model', args: [], flags: { set: 'grok-4' } } },
    { input: '/test -v', expected: { name: 'test', args: [], flags: { v: true } } },

    // Mixed
    { input: '/cmd arg1 --flag arg2', expected: { name: 'cmd', args: ['arg1', 'arg2'], flags: { flag: true } } },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    if ('isCommand' in test) {
      const result = isCommand(test.input);
      if (result === test.isCommand) {
        console.log(`PASS: isCommand("${test.input}") = ${result}`);
        passed++;
      } else {
        console.log(`FAIL: isCommand("${test.input}") expected ${test.isCommand}, got ${result}`);
        failed++;
      }
    } else if ('expected' in test) {
      const result = parseCommand(test.input);
      const matches =
        result.name === test.expected.name &&
        JSON.stringify(result.args) === JSON.stringify(test.expected.args) &&
        JSON.stringify(result.flags) === JSON.stringify(test.expected.flags);

      if (matches) {
        console.log(`PASS: parseCommand("${test.input}")`);
        passed++;
      } else {
        console.log(`FAIL: parseCommand("${test.input}")`);
        console.log(`  Expected: ${JSON.stringify(test.expected)}`);
        console.log(`  Got: ${JSON.stringify({ name: result.name, args: result.args, flags: result.flags })}`);
        failed++;
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
