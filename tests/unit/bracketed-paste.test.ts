import { describe, it, expect } from 'vitest';
import {
  PASTE_START,
  PASTE_END,
  processPasteData,
  getMultiLineDisplay,
  PasteState,
} from '../../src/ui/utils/bracketed-paste.js';

/**
 * Tests for bracketed paste mode handling.
 *
 * Covers:
 * - Paste start/end sequence detection
 * - Buffer accumulation across chunks
 * - Single-chunk complete paste
 * - Multi-chunk paste assembly
 * - State transitions
 */

describe('bracketed paste', () => {
  describe('processPasteData', () => {
    it('should detect paste start and end in same chunk', () => {
      const initialState: PasteState = { isPasting: false, buffer: '' };
      const data = `${PASTE_START}pasted content${PASTE_END}`;

      const result = processPasteData(data, initialState);

      expect(result.state.isPasting).toBe(false);
      expect(result.state.buffer).toBe('');
      expect(result.contentToAppend).toBe('pasted content');
      expect(result.handleByUseInput).toBe(false);
    });

    it('should handle paste start without end (begin pasting)', () => {
      const initialState: PasteState = { isPasting: false, buffer: '' };
      const data = `${PASTE_START}partial content`;

      const result = processPasteData(data, initialState);

      expect(result.state.isPasting).toBe(true);
      expect(result.state.buffer).toBe('partial content');
      expect(result.contentToAppend).toBeNull();
      expect(result.handleByUseInput).toBe(false);
    });

    it('should accumulate content while pasting', () => {
      const initialState: PasteState = { isPasting: true, buffer: 'chunk1' };
      const data = 'chunk2';

      const result = processPasteData(data, initialState);

      expect(result.state.isPasting).toBe(true);
      expect(result.state.buffer).toBe('chunk1chunk2');
      expect(result.contentToAppend).toBeNull();
      expect(result.handleByUseInput).toBe(false);
    });

    it('should complete paste on end sequence', () => {
      const initialState: PasteState = { isPasting: true, buffer: 'accumulated ' };
      const data = `content${PASTE_END}`;

      const result = processPasteData(data, initialState);

      expect(result.state.isPasting).toBe(false);
      expect(result.state.buffer).toBe('');
      expect(result.contentToAppend).toBe('accumulated content');
      expect(result.handleByUseInput).toBe(false);
    });

    it('should handle multi-line pasted content', () => {
      const initialState: PasteState = { isPasting: false, buffer: '' };
      const pastedText = 'Line 1\nLine 2\nLine 3';
      const data = `${PASTE_START}${pastedText}${PASTE_END}`;

      const result = processPasteData(data, initialState);

      expect(result.contentToAppend).toBe(pastedText);
      expect(result.state.isPasting).toBe(false);
    });

    it('should allow normal input when not pasting', () => {
      const initialState: PasteState = { isPasting: false, buffer: '' };
      const data = 'a'; // Regular typed character

      const result = processPasteData(data, initialState);

      expect(result.handleByUseInput).toBe(true);
      expect(result.state).toBe(initialState); // State unchanged
      expect(result.contentToAppend).toBeNull();
    });

    it('should handle empty paste', () => {
      const initialState: PasteState = { isPasting: false, buffer: '' };
      const data = `${PASTE_START}${PASTE_END}`;

      const result = processPasteData(data, initialState);

      expect(result.contentToAppend).toBe('');
      expect(result.state.isPasting).toBe(false);
    });

    it('should simulate multi-chunk paste sequence', () => {
      // Chunk 1: paste start + partial content
      const state1: PasteState = { isPasting: false, buffer: '' };
      const chunk1 = `${PASTE_START}First part`;
      const result1 = processPasteData(chunk1, state1);

      expect(result1.state.isPasting).toBe(true);
      expect(result1.state.buffer).toBe('First part');

      // Chunk 2: more content (no end yet)
      const chunk2 = ' middle part';
      const result2 = processPasteData(chunk2, result1.state);

      expect(result2.state.isPasting).toBe(true);
      expect(result2.state.buffer).toBe('First part middle part');

      // Chunk 3: final content + paste end
      const chunk3 = ` last part${PASTE_END}`;
      const result3 = processPasteData(chunk3, result2.state);

      expect(result3.state.isPasting).toBe(false);
      expect(result3.contentToAppend).toBe('First part middle part last part');
    });
  });

  describe('getMultiLineDisplay', () => {
    it('should show single-line value unchanged', () => {
      const value = 'Single line input';
      const result = getMultiLineDisplay(value);

      expect(result.display).toBe(value);
      expect(result.isMultiLine).toBe(false);
      expect(result.lineCount).toBe(1);
    });

    it('should show first line + count for multi-line', () => {
      const value = 'First line\nSecond line\nThird line';
      const result = getMultiLineDisplay(value);

      expect(result.display).toBe('First line... [3 lines]');
      expect(result.isMultiLine).toBe(true);
      expect(result.lineCount).toBe(3);
    });

    it('should handle two-line input', () => {
      const value = 'Line 1\nLine 2';
      const result = getMultiLineDisplay(value);

      expect(result.display).toBe('Line 1... [2 lines]');
      expect(result.lineCount).toBe(2);
    });

    it('should handle empty string', () => {
      const value = '';
      const result = getMultiLineDisplay(value);

      expect(result.display).toBe('');
      expect(result.isMultiLine).toBe(false);
      expect(result.lineCount).toBe(1);
    });
  });
});
