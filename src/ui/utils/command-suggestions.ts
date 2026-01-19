/**
 * Command Suggestions Utility
 *
 * Provides filtering, ranking, and fuzzy matching for command palette.
 * Supports exact match, prefix match, alias match, substring match, and fuzzy match.
 */

import type { Command } from '../../commands/types.js';

/**
 * Match types for suggestion ranking
 */
export type MatchType = 'exact' | 'prefix' | 'alias-exact' | 'alias-prefix' | 'substring' | 'fuzzy';

/**
 * Command suggestion with match metadata
 */
export interface CommandSuggestion {
  command: Command;
  matchType: MatchType;
  score: number;
  matchedAlias?: string;
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching typos.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance (lower is more similar)
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Determine match type and score for a query against a command.
 *
 * @param query - User's search query (e.g., "pr", "promt")
 * @param command - Command definition
 * @returns Match metadata or null if no match
 */
export function matchCommand(query: string, command: Command): CommandSuggestion | null {
  const queryLower = query.toLowerCase();
  const nameLower = command.name.toLowerCase();

  // Exact match (highest priority)
  if (queryLower === nameLower) {
    return { command, matchType: 'exact', score: 1000 };
  }

  // Prefix match on name
  if (nameLower.startsWith(queryLower)) {
    return { command, matchType: 'prefix', score: 900 };
  }

  // Check aliases
  for (const alias of command.aliases) {
    const aliasLower = alias.toLowerCase();

    // Exact alias match
    if (queryLower === aliasLower) {
      return { command, matchType: 'alias-exact', score: 800, matchedAlias: alias };
    }

    // Prefix alias match
    if (aliasLower.startsWith(queryLower)) {
      return { command, matchType: 'alias-prefix', score: 700, matchedAlias: alias };
    }
  }

  // Substring match in name
  if (nameLower.includes(queryLower)) {
    return { command, matchType: 'substring', score: 600 };
  }

  // Fuzzy match (typo tolerance)
  // Only for queries >= 3 chars, distance <= 2
  if (query.length >= 3) {
    const distance = levenshteinDistance(queryLower, nameLower);
    if (distance <= 2) {
      return { command, matchType: 'fuzzy', score: 500 - distance * 100 };
    }

    // Also check fuzzy against aliases
    for (const alias of command.aliases) {
      const aliasDistance = levenshteinDistance(queryLower, alias.toLowerCase());
      if (aliasDistance <= 2) {
        return { command, matchType: 'fuzzy', score: 400 - aliasDistance * 100, matchedAlias: alias };
      }
    }
  }

  return null;
}

/**
 * Get command suggestions based on user input.
 *
 * @param input - Raw user input (may start with /)
 * @param commands - Available commands
 * @returns Sorted suggestions (best matches first)
 */
export function getCommandSuggestions(input: string, commands: Command[]): CommandSuggestion[] {
  // If input doesn't start with /, return empty
  if (!input.startsWith('/')) {
    return [];
  }

  // Extract command portion (before first space or entire string)
  const commandPart = input.slice(1).split(' ')[0].trim();

  // Empty query (just "/") - return all commands
  if (commandPart === '') {
    return commands.map(cmd => ({
      command: cmd,
      matchType: 'prefix' as MatchType,
      score: 900,
    })).sort((a, b) => a.command.name.localeCompare(b.command.name));
  }

  // Match against all commands
  const suggestions: CommandSuggestion[] = [];

  for (const command of commands) {
    const match = matchCommand(commandPart, command);
    if (match) {
      suggestions.push(match);
    }
  }

  // Sort by score (descending), then by name (ascending) for stability
  suggestions.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.command.name.localeCompare(b.command.name);
  });

  return suggestions;
}

/**
 * Get "did you mean" suggestions for an unknown command.
 *
 * @param unknownCommand - The command that wasn't found (without leading /)
 * @param commands - Available commands
 * @param maxSuggestions - Maximum number of suggestions to return (default: 3)
 * @returns Top suggestions (fuzzy/substring matches only)
 */
export function getDidYouMeanSuggestions(
  unknownCommand: string,
  commands: Command[],
  maxSuggestions: number = 3
): CommandSuggestion[] {
  const suggestions = getCommandSuggestions(`/${unknownCommand}`, commands);

  // Only return fuzzy/substring matches (not exact/prefix - those would have been found)
  const relevantSuggestions = suggestions.filter(
    s => s.matchType === 'fuzzy' || s.matchType === 'substring'
  );

  return relevantSuggestions.slice(0, maxSuggestions);
}

/**
 * Get single "did you mean" suggestion for an unknown command.
 * @deprecated Use getDidYouMeanSuggestions() for multiple suggestions
 */
export function getDidYouMeanSuggestion(
  unknownCommand: string,
  commands: Command[]
): CommandSuggestion | null {
  const suggestions = getDidYouMeanSuggestions(unknownCommand, commands, 1);
  return suggestions[0] || null;
}
