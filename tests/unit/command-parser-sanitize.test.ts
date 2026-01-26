import { describe, it, expect } from 'vitest';
import { parseInput, parseCommand } from '../../src/commands/parser.js';
import { sanitizeControlSequences, containsPasteMarkers } from '../../src/commands/utils.js';

/**
 * Tests for control sequence sanitization in command parsing.
 *
 * Covers:
 * - Bracketed paste marker removal (\x1b[200~, \x1b[201~, [200~, [201~)
 * - General ANSI/VT sequence removal
 * - Parser integration (parseInput sanitizes before processing)
 * - Real-world scenarios (pasted /prompt commands)
 */

describe('control sequence sanitization', () => {
  describe('sanitizeControlSequences', () => {
    it('should remove bracketed paste start marker with ESC', () => {
      const input = '\x1b[200~hello world\x1b[201~';
      const result = sanitizeControlSequences(input);

      expect(result).toBe('hello world');
    });

    it('should remove bracketed paste markers without ESC prefix', () => {
      const input = '[200~hello world[201~';
      const result = sanitizeControlSequences(input);

      expect(result).toBe('hello world');
    });

    it('should remove ANSI color codes', () => {
      const input = 'hello \x1b[1;32mworld\x1b[0m';
      const result = sanitizeControlSequences(input);

      expect(result).toBe('hello world');
    });

    it('should remove mixed control sequences', () => {
      const input = '\x1b[200~\x1b[1mBold Text\x1b[0m\x1b[201~';
      const result = sanitizeControlSequences(input);

      expect(result).toBe('Bold Text');
    });

    it('should preserve normal text', () => {
      const input = 'normal text with no sequences';
      const result = sanitizeControlSequences(input);

      expect(result).toBe(input);
    });

    it('should handle empty string', () => {
      const result = sanitizeControlSequences('');
      expect(result).toBe('');
    });

    it('should remove paste markers from file paths', () => {
      const input = 'docs/GROK-SUBAGENT-SMOKE-TEST.md[200~';
      const result = sanitizeControlSequences(input);

      expect(result).toBe('docs/GROK-SUBAGENT-SMOKE-TEST.md');
    });
  });

  describe('containsPasteMarkers', () => {
    it('should detect paste markers with ESC', () => {
      expect(containsPasteMarkers('\x1b[200~text')).toBe(true);
      expect(containsPasteMarkers('text\x1b[201~')).toBe(true);
    });

    it('should detect paste markers without ESC', () => {
      expect(containsPasteMarkers('[200~text')).toBe(true);
      expect(containsPasteMarkers('text[201~')).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(containsPasteMarkers('normal text')).toBe(false);
    });
  });

  describe('parseInput with sanitization', () => {
    it('should parse command with bracketed paste markers (ESC prefix)', () => {
      const input = '\x1b[200~/prompt docs/GROK-SUBAGENT-SMOKE-TEST.md\x1b[201~';
      const result = parseInput(input);

      expect(result.type).toBe('command');
      if (result.type === 'command') {
        expect(result.command.name).toBe('prompt');
        expect(result.command.args[0]).toBe('docs/GROK-SUBAGENT-SMOKE-TEST.md');
        expect(result.command.args[0]).not.toContain('[200~');
        expect(result.command.args[0]).not.toContain('[201~');
      }
    });

    it('should parse command with ESC-stripped paste markers', () => {
      const input = '[200~/prompt docs/GROK-SUBAGENT-SMOKE-TEST.md[201~';
      const result = parseInput(input);

      expect(result.type).toBe('command');
      if (result.type === 'command') {
        expect(result.command.name).toBe('prompt');
        expect(result.command.args[0]).toBe('docs/GROK-SUBAGENT-SMOKE-TEST.md');
      }
    });

    it('should parse /prompt with paste markers in middle of path', () => {
      const input = '/prompt docs/GROK-SUBAGENT[200~-SMOKE-TEST.md';
      const result = parseInput(input);

      expect(result.type).toBe('command');
      if (result.type === 'command') {
        expect(result.command.args[0]).toBe('docs/GROK-SUBAGENT-SMOKE-TEST.md');
      }
    });

    it('should parse /prompt with ANSI codes in path', () => {
      const input = '/prompt docs/\x1b[1mGROK\x1b[0m-TEST.md';
      const result = parseInput(input);

      expect(result.type).toBe('command');
      if (result.type === 'command') {
        expect(result.command.args[0]).toBe('docs/GROK-TEST.md');
      }
    });

    it('should handle multiple commands with paste markers', () => {
      const commands = [
        '\x1b[200~/help\x1b[201~',
        '[200~/model grok-4[201~',
        '/exit\x1b[200~\x1b[201~',
      ];

      for (const cmd of commands) {
        const result = parseInput(cmd);
        expect(result.type).toBe('command');
        if (result.type === 'command') {
          expect(result.command.rawArgs).not.toContain('[200~');
          expect(result.command.rawArgs).not.toContain('[201~');
        }
      }
    });

    it('should preserve message content after sanitization', () => {
      const input = '\x1b[200~Hello, this is a message\x1b[201~';
      const result = parseInput(input);

      expect(result.type).toBe('message');
      if (result.type === 'message') {
        expect(result.content).toBe('Hello, this is a message');
      }
    });
  });

  describe('parseCommand after sanitization', () => {
    it('should extract clean arguments from corrupted input', () => {
      // Simulate what happens after parseInput sanitizes
      const sanitized = sanitizeControlSequences('[200~/model grok-4-1-fast[201~');
      const result = parseCommand(sanitized);

      expect(result.name).toBe('model');
      expect(result.args[0]).toBe('grok-4-1-fast');
    });

    it('should handle quote-wrapped paths with paste markers', () => {
      const input = '/prompt "docs/file[200~.md"';
      const result = parseInput(input);

      expect(result.type).toBe('command');
      if (result.type === 'command') {
        // Markers inside quotes still get sanitized
        expect(result.command.args[0]).not.toContain('[200~');
      }
    });
  });
});
