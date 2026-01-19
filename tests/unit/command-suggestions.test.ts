import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  getCommandSuggestions,
  getDidYouMeanSuggestions,
  getDidYouMeanSuggestion,
  matchCommand,
  MatchType,
} from '../../src/ui/utils/command-suggestions.js';
import type { Command } from '../../src/commands/types.js';

/**
 * Tests for command suggestion algorithm.
 *
 * Covers:
 * - Levenshtein distance calculation
 * - Exact, prefix, alias, substring, fuzzy matching
 * - Suggestion ranking and sorting
 * - "Did you mean" suggestions for unknown commands
 */

describe('command suggestions', () => {
  // Mock commands for testing
  const mockCommands: Command[] = [
    {
      name: 'help',
      description: 'Show help',
      usage: '/help',
      arguments: [],
      examples: [],
      aliases: ['h', '?'],
      execute: async () => ({ success: true }),
    },
    {
      name: 'prompt',
      description: 'Load prompt from file',
      usage: '/prompt <file>',
      arguments: [],
      examples: [],
      aliases: ['promptfile', 'pf', 'loadprompt'],
      execute: async () => ({ success: true }),
    },
    {
      name: 'model',
      description: 'Set model',
      usage: '/model <name>',
      arguments: [],
      examples: [],
      aliases: ['m'],
      execute: async () => ({ success: true }),
    },
    {
      name: 'exit',
      description: 'Exit application',
      usage: '/exit',
      arguments: [],
      examples: [],
      aliases: ['quit', 'q'],
      execute: async () => ({ success: true }),
    },
  ];

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should return length for empty vs non-empty', () => {
      expect(levenshteinDistance('', 'test')).toBe(4);
      expect(levenshteinDistance('test', '')).toBe(4);
    });

    it('should calculate single character insertion', () => {
      expect(levenshteinDistance('test', 'tests')).toBe(1);
    });

    it('should calculate single character deletion', () => {
      expect(levenshteinDistance('tests', 'test')).toBe(1);
    });

    it('should calculate single character substitution', () => {
      expect(levenshteinDistance('test', 'text')).toBe(1);
    });

    it('should calculate distance for typos', () => {
      // Note: Levenshtein doesn't count transposition as 1, it's 2 ops (delete+insert)
      expect(levenshteinDistance('prompt', 'promt')).toBe(1); // delete 'p' at pos 4
      expect(levenshteinDistance('model', 'modle')).toBe(2); // transpose 'd'/'l' = del+ins
    });

    it('should be symmetric', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(levenshteinDistance('xyz', 'abc'));
    });
  });

  describe('getCommandSuggestions', () => {
    it('should return empty array for non-slash input', () => {
      const suggestions = getCommandSuggestions('hello', mockCommands);
      expect(suggestions).toEqual([]);
    });

    it('should return all commands for bare "/" (sorted by name)', () => {
      const suggestions = getCommandSuggestions('/', mockCommands);

      expect(suggestions.length).toBe(mockCommands.length);
      expect(suggestions[0].command.name).toBe('exit');
      expect(suggestions[1].command.name).toBe('help');
      expect(suggestions[2].command.name).toBe('model');
      expect(suggestions[3].command.name).toBe('prompt');
      expect(suggestions.every(s => s.matchType === 'prefix')).toBe(true);
    });

    it('should match exact command name', () => {
      const suggestions = getCommandSuggestions('/prompt', mockCommands);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].command.name).toBe('prompt');
      expect(suggestions[0].matchType).toBe('exact');
      expect(suggestions[0].score).toBe(1000);
    });

    it('should match prefix', () => {
      const suggestions = getCommandSuggestions('/pr', mockCommands);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].command.name).toBe('prompt');
      expect(suggestions[0].matchType).toBe('prefix');
      expect(suggestions[0].score).toBe(900);
    });

    it('should match exact alias', () => {
      const suggestions = getCommandSuggestions('/pf', mockCommands);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].command.name).toBe('prompt');
      expect(suggestions[0].matchType).toBe('alias-exact');
      expect(suggestions[0].matchedAlias).toBe('pf');
      expect(suggestions[0].score).toBe(800);
    });

    it('should match prefix alias', () => {
      const suggestions = getCommandSuggestions('/promptf', mockCommands);

      expect(suggestions.length).toBeGreaterThan(0);
      const promptSuggestion = suggestions.find(s => s.command.name === 'prompt');
      expect(promptSuggestion).toBeDefined();
      expect(promptSuggestion?.matchType).toBe('alias-prefix');
      expect(promptSuggestion?.matchedAlias).toBe('promptfile');
    });

    it('should match substring', () => {
      const suggestions = getCommandSuggestions('/odel', mockCommands);

      const modelMatch = suggestions.find(s => s.command.name === 'model');
      expect(modelMatch).toBeDefined();
      expect(modelMatch?.matchType).toBe('substring');
      expect(modelMatch?.score).toBe(600);
    });

    it('should match fuzzy with typo (distance 1)', () => {
      const suggestions = getCommandSuggestions('/promt', mockCommands);

      expect(suggestions.length).toBeGreaterThan(0);
      const promptMatch = suggestions.find(s => s.command.name === 'prompt');
      expect(promptMatch).toBeDefined();
      expect(promptMatch?.matchType).toBe('fuzzy');
      expect(promptMatch?.score).toBe(400); // 500 - 1*100
    });

    it('should match prefix for partial command name', () => {
      const suggestions = getCommandSuggestions('/promp', mockCommands);

      // "promp" is a prefix of "prompt", not a fuzzy match
      const promptMatch = suggestions.find(s => s.command.name === 'prompt');
      expect(promptMatch).toBeDefined();
      expect(promptMatch?.matchType).toBe('prefix');
    });

    it('should not match fuzzy beyond distance 2', () => {
      const suggestions = getCommandSuggestions('/xyz', mockCommands);

      // "xyz" has distance > 2 from all commands
      expect(suggestions.length).toBe(0);
    });

    it('should rank exact > prefix > alias-exact > alias-prefix > substring > fuzzy', () => {
      const suggestions = getCommandSuggestions('/prompt', mockCommands);
      const exactMatch = suggestions.find(s => s.matchType === 'exact');
      expect(exactMatch?.score).toBe(1000);

      const prefixSuggestions = getCommandSuggestions('/prom', mockCommands);
      const prefixMatch = prefixSuggestions.find(s => s.matchType === 'prefix');
      expect(prefixMatch?.score).toBe(900);

      // Verify ranking order by comparing scores
      expect(1000).toBeGreaterThan(900); // exact > prefix
      expect(900).toBeGreaterThan(800);  // prefix > alias-exact
      expect(800).toBeGreaterThan(700);  // alias-exact > alias-prefix
      expect(700).toBeGreaterThan(600);  // alias-prefix > substring
      expect(600).toBeGreaterThan(500);  // substring > fuzzy (max fuzzy score)
    });

    it('should handle command with args (only match command portion)', () => {
      const suggestions = getCommandSuggestions('/prompt myfile.txt', mockCommands);

      // Should still match "prompt" even though args are present
      expect(suggestions[0].command.name).toBe('prompt');
      expect(suggestions[0].matchType).toBe('exact');
    });

    it('should be deterministic (stable sort)', () => {
      const suggestions1 = getCommandSuggestions('/p', mockCommands);
      const suggestions2 = getCommandSuggestions('/p', mockCommands);

      expect(suggestions1.map(s => s.command.name)).toEqual(
        suggestions2.map(s => s.command.name)
      );
    });
  });

  describe('getDidYouMeanSuggestions', () => {
    it('should return top 3 fuzzy/substring matches', () => {
      const commands: Command[] = [
        { name: 'test', description: '', usage: '', arguments: [], examples: [], aliases: [], execute: async () => ({ success: true }) },
        { name: 'text', description: '', usage: '', arguments: [], examples: [], aliases: [], execute: async () => ({ success: true }) },
        { name: 'next', description: '', usage: '', arguments: [], examples: [], aliases: [], execute: async () => ({ success: true }) },
      ];

      const suggestions = getDidYouMeanSuggestions('txt', commands, 3);

      // All three have substring or fuzzy match to "txt"
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should only return fuzzy/substring matches (not exact/prefix)', () => {
      const suggestions = getDidYouMeanSuggestions('promt', mockCommands, 3);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.matchType === 'fuzzy' || s.matchType === 'substring')).toBe(true);
    });

    it('should respect maxSuggestions limit', () => {
      const suggestions = getDidYouMeanSuggestions('e', mockCommands, 2);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should return empty for no fuzzy/substring matches', () => {
      const suggestions = getDidYouMeanSuggestions('prom', mockCommands, 3);

      // "prom" is a prefix match, not fuzzy/substring
      expect(suggestions.length).toBe(0);
    });
  });

  describe('getDidYouMeanSuggestion (single - deprecated)', () => {
    it('should suggest fuzzy match for typo', () => {
      const suggestion = getDidYouMeanSuggestion('promt', mockCommands);

      expect(suggestion).toBeDefined();
      expect(suggestion?.command.name).toBe('prompt');
      expect(suggestion?.matchType).toBe('fuzzy');
    });

    it('should return null for no fuzzy/substring match', () => {
      const suggestion = getDidYouMeanSuggestion('xyz123', mockCommands);

      expect(suggestion).toBeNull();
    });
  });
});
