import { describe, it, expect } from 'vitest';
import {
  formatToolOutput,
  containsEvidenceBlock,
  FormatOptions,
} from '../../src/ui/utils/format-tool-output.js';

describe('formatToolOutput', () => {
  describe('short output (no truncation)', () => {
    it('should return unchanged output when under maxChars', () => {
      const output = 'Short output';
      const result = formatToolOutput(output);

      expect(result.text).toBe(output);
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(output.length);
      expect(result.hiddenChars).toBe(0);
    });

    it('should return unchanged output at exactly maxChars', () => {
      const output = 'x'.repeat(20000);
      const result = formatToolOutput(output);

      expect(result.text).toBe(output);
      expect(result.truncated).toBe(false);
    });
  });

  describe('long output (truncation applied)', () => {
    it('should truncate output exceeding maxChars', () => {
      const output = 'x'.repeat(25000);
      const result = formatToolOutput(output);

      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(25000);
      expect(result.hiddenChars).toBe(25000 - 8000 - 8000); // 9000
      expect(result.text.length).toBeLessThan(output.length);
    });

    it('should include truncation banner with stats', () => {
      const output = 'x'.repeat(25000);
      const result = formatToolOutput(output);

      expect(result.text).toContain('[...');
      expect(result.text).toContain('chars hidden');
      expect(result.text).toContain('total 25,000 chars');
      expect(result.text).toContain('first 8,000');
      expect(result.text).toContain('last 8,000');
    });

    it('should preserve head content', () => {
      const head = 'HEAD_MARKER_' + 'a'.repeat(7988); // 8000 chars
      const middle = 'b'.repeat(10000);
      const tail = 'c'.repeat(8000);
      const output = head + middle + tail;

      const result = formatToolOutput(output);

      expect(result.text.startsWith('HEAD_MARKER_')).toBe(true);
    });

    it('should preserve tail content (evidence block)', () => {
      const head = 'a'.repeat(8000);
      const middle = 'b'.repeat(10000);
      const evidence = '\n=== EVIDENCE ===\nTools executed: Read(3), Grep(2)\nTotal tool calls: 5\nSubagents spawned: 1 (Task 1/1 succeeded)\n';
      const tail = 'c'.repeat(8000 - evidence.length) + evidence;
      const output = head + middle + tail;

      const result = formatToolOutput(output);

      expect(result.truncated).toBe(true);
      expect(result.text).toContain('=== EVIDENCE ===');
      expect(result.text).toContain('Subagents spawned: 1');
    });
  });

  describe('custom options', () => {
    it('should respect custom maxChars', () => {
      const output = 'x'.repeat(1000);
      const options: FormatOptions = { maxChars: 500, headChars: 200, tailChars: 200 };
      const result = formatToolOutput(output, options);

      expect(result.truncated).toBe(true);
      expect(result.hiddenChars).toBe(1000 - 200 - 200); // 600
    });

    it('should not truncate when head + tail >= length', () => {
      const output = 'x'.repeat(100);
      const options: FormatOptions = { maxChars: 50, headChars: 60, tailChars: 60 };
      const result = formatToolOutput(output, options);

      // head + tail (120) > output (100), so no truncation
      expect(result.truncated).toBe(false);
      expect(result.text).toBe(output);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = formatToolOutput('');

      expect(result.text).toBe('');
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(0);
    });

    it('should handle output with newlines', () => {
      const lines = Array(1000).fill('Line content here').join('\n');
      const result = formatToolOutput(lines, { maxChars: 500, headChars: 200, tailChars: 200 });

      expect(result.truncated).toBe(true);
      expect(result.text).toContain('\n');
    });

    it('should handle unicode characters', () => {
      const output = '\u{1F680}'.repeat(10000); // rocket emoji
      const result = formatToolOutput(output, { maxChars: 500, headChars: 200, tailChars: 200 });

      expect(result.truncated).toBe(true);
      // JS string length counts UTF-16 code units, so emoji = 2 chars
      expect(result.originalLength).toBe(20000);
    });
  });
});

describe('containsEvidenceBlock', () => {
  it('should detect evidence block', () => {
    const text = 'Some output\n=== EVIDENCE ===\nTools: Read(1)';
    expect(containsEvidenceBlock(text)).toBe(true);
  });

  it('should return false when no evidence block', () => {
    const text = 'Just regular output without evidence';
    expect(containsEvidenceBlock(text)).toBe(false);
  });

  it('should detect evidence block after truncation', () => {
    const head = 'a'.repeat(8000);
    const middle = 'b'.repeat(10000);
    const evidence = '\n=== EVIDENCE ===\nSubagents spawned: 1\n';
    const tail = 'c'.repeat(8000 - evidence.length) + evidence;
    const output = head + middle + tail;

    const result = formatToolOutput(output);

    expect(result.truncated).toBe(true);
    expect(containsEvidenceBlock(result.text)).toBe(true);
  });
});
