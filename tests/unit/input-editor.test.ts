import { describe, it, expect } from 'vitest';
import {
  createEditorState,
  insertAtCursor,
  deleteBackward,
  deleteForward,
  moveCursor,
  moveCursorToBoundary,
  setCursor,
  setValue,
  renderWithCursor,
  getDisplayWithCursor,
  EditorState,
} from '../../src/ui/utils/input-editor.js';

/**
 * Tests for input editor utility.
 *
 * Covers:
 * - Cursor-based insertion
 * - Backspace/delete at cursor
 * - Left/right/home/end cursor movement
 * - Paste insertion at cursor
 * - Cursor rendering in single/multi-line input
 */

describe('input editor', () => {
  describe('createEditorState', () => {
    it('should create empty state', () => {
      const state = createEditorState();
      expect(state.value).toBe('');
      expect(state.cursorIndex).toBe(0);
    });

    it('should create state with initial value', () => {
      const state = createEditorState('hello');
      expect(state.value).toBe('hello');
      expect(state.cursorIndex).toBe(5); // Cursor at end
    });
  });

  describe('insertAtCursor', () => {
    it('should insert at end of empty string', () => {
      const state = createEditorState();
      const result = insertAtCursor(state, 'a');

      expect(result.value).toBe('a');
      expect(result.cursorIndex).toBe(1);
    });

    it('should insert at cursor in middle', () => {
      const state: EditorState = { value: 'helo', cursorIndex: 2 };
      const result = insertAtCursor(state, 'l');

      expect(result.value).toBe('hello');
      expect(result.cursorIndex).toBe(3);
    });

    it('should insert at beginning', () => {
      const state: EditorState = { value: 'world', cursorIndex: 0 };
      const result = insertAtCursor(state, 'hello ');

      expect(result.value).toBe('hello world');
      expect(result.cursorIndex).toBe(6);
    });

    it('should insert multi-character string', () => {
      const state: EditorState = { value: 'ac', cursorIndex: 1 };
      const result = insertAtCursor(state, 'b');

      expect(result.value).toBe('abc');
      expect(result.cursorIndex).toBe(2);
    });
  });

  describe('deleteBackward', () => {
    it('should do nothing at start', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 0 };
      const result = deleteBackward(state);

      expect(result.value).toBe('hello');
      expect(result.cursorIndex).toBe(0);
    });

    it('should delete character before cursor', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 5 };
      const result = deleteBackward(state);

      expect(result.value).toBe('hell');
      expect(result.cursorIndex).toBe(4);
    });

    it('should delete from middle', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 2 };
      const result = deleteBackward(state);

      expect(result.value).toBe('hllo');
      expect(result.cursorIndex).toBe(1);
    });
  });

  describe('deleteForward', () => {
    it('should do nothing at end', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 5 };
      const result = deleteForward(state);

      expect(result.value).toBe('hello');
      expect(result.cursorIndex).toBe(5);
    });

    it('should delete character at cursor', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 0 };
      const result = deleteForward(state);

      expect(result.value).toBe('ello');
      expect(result.cursorIndex).toBe(0); // Cursor stays
    });

    it('should delete from middle', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 2 };
      const result = deleteForward(state);

      expect(result.value).toBe('helo');
      expect(result.cursorIndex).toBe(2);
    });
  });

  describe('moveCursor', () => {
    it('should move left', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 3 };
      const result = moveCursor(state, 'left');

      expect(result.value).toBe('hello');
      expect(result.cursorIndex).toBe(2);
    });

    it('should not move left past start', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 0 };
      const result = moveCursor(state, 'left');

      expect(result.cursorIndex).toBe(0);
    });

    it('should move right', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 2 };
      const result = moveCursor(state, 'right');

      expect(result.cursorIndex).toBe(3);
    });

    it('should not move right past end', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 5 };
      const result = moveCursor(state, 'right');

      expect(result.cursorIndex).toBe(5);
    });
  });

  describe('moveCursorToBoundary', () => {
    it('should move to start', () => {
      const state: EditorState = { value: 'hello world', cursorIndex: 6 };
      const result = moveCursorToBoundary(state, 'start');

      expect(result.cursorIndex).toBe(0);
    });

    it('should move to end', () => {
      const state: EditorState = { value: 'hello world', cursorIndex: 3 };
      const result = moveCursorToBoundary(state, 'end');

      expect(result.cursorIndex).toBe(11);
    });
  });

  describe('setCursor', () => {
    it('should set cursor to specific index', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 0 };
      const result = setCursor(state, 3);

      expect(result.cursorIndex).toBe(3);
    });

    it('should clamp negative index to 0', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 2 };
      const result = setCursor(state, -5);

      expect(result.cursorIndex).toBe(0);
    });

    it('should clamp index beyond end to value.length', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 2 };
      const result = setCursor(state, 999);

      expect(result.cursorIndex).toBe(5);
    });
  });

  describe('setValue', () => {
    it('should replace value and move cursor to end', () => {
      const state: EditorState = { value: 'old', cursorIndex: 1 };
      const result = setValue(state, 'new value');

      expect(result.value).toBe('new value');
      expect(result.cursorIndex).toBe(9);
    });
  });

  describe('renderWithCursor', () => {
    it('should render cursor at end', () => {
      const result = renderWithCursor('hello', 5);
      expect(result).toBe('hello|');
    });

    it('should render cursor at start', () => {
      const result = renderWithCursor('hello', 0);
      expect(result).toBe('|hello');
    });

    it('should render cursor in middle', () => {
      const result = renderWithCursor('hello', 2);
      expect(result).toBe('he|llo');
    });

    it('should use custom cursor character', () => {
      const result = renderWithCursor('hello', 2, '_');
      expect(result).toBe('he_llo');
    });

    it('should handle empty string', () => {
      const result = renderWithCursor('', 0);
      expect(result).toBe('|');
    });

    it('should clamp cursor beyond bounds', () => {
      const result = renderWithCursor('hello', 999);
      expect(result).toBe('hello|');
    });
  });

  describe('getDisplayWithCursor', () => {
    it('should show full single-line value with cursor', () => {
      const state: EditorState = { value: 'hello', cursorIndex: 2 };
      const display = getDisplayWithCursor(state);

      expect(display.display).toBe('he|llo');
      expect(display.isMultiLine).toBe(false);
      expect(display.lineCount).toBe(1);
    });

    it('should show first line + count for multi-line', () => {
      const state: EditorState = { value: 'line1\nline2\nline3', cursorIndex: 3 };
      const display = getDisplayWithCursor(state);

      expect(display.display).toContain('lin|e1');
      expect(display.display).toContain('[3 lines]');
      expect(display.isMultiLine).toBe(true);
      expect(display.lineCount).toBe(3);
    });

    it('should indicate cursor line for multi-line when not on first line', () => {
      const state: EditorState = { value: 'line1\nline2\nline3', cursorIndex: 8 };
      const display = getDisplayWithCursor(state);

      expect(display.display).toContain('cursor on line 2');
      expect(display.isMultiLine).toBe(true);
    });

    it('should handle cursor at very end of multi-line', () => {
      const state: EditorState = { value: 'a\nb\nc', cursorIndex: 5 };
      const display = getDisplayWithCursor(state);

      expect(display.display).toContain('cursor on line 3');
    });
  });

  describe('complex editing scenarios', () => {
    it('should handle: type "hello", move left 2, insert "X"', () => {
      let state = createEditorState();
      state = insertAtCursor(state, 'hello');
      expect(state.value).toBe('hello');
      expect(state.cursorIndex).toBe(5);

      state = moveCursor(state, 'left');
      state = moveCursor(state, 'left');
      expect(state.cursorIndex).toBe(3);

      state = insertAtCursor(state, 'X');
      expect(state.value).toBe('helXlo');
      expect(state.cursorIndex).toBe(4);
    });

    it('should handle: type "abc", home, delete forward', () => {
      let state = createEditorState();
      state = insertAtCursor(state, 'abc');
      state = moveCursorToBoundary(state, 'start');
      expect(state.cursorIndex).toBe(0);

      state = deleteForward(state);
      expect(state.value).toBe('bc');
      expect(state.cursorIndex).toBe(0);
    });

    it('should handle: paste multi-line at cursor', () => {
      let state: EditorState = { value: 'before after', cursorIndex: 7 };
      const pastedContent = 'PASTE\nLINE2';

      state = insertAtCursor(state, pastedContent);

      expect(state.value).toBe('before PASTE\nLINE2after');
      expect(state.cursorIndex).toBe(7 + pastedContent.length);
    });
  });
});
