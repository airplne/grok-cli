/**
 * Input Editor State Management
 *
 * Pure functions for cursor-based line editing.
 * Supports insertion, deletion, cursor movement, and rendering with cursor marker.
 */

/**
 * Editor state
 */
export interface EditorState {
  value: string;
  cursorIndex: number;
}

/**
 * Create initial editor state
 */
export function createEditorState(initialValue: string = ''): EditorState {
  return {
    value: initialValue,
    cursorIndex: initialValue.length,
  };
}

/**
 * Insert text at cursor position.
 *
 * @param state - Current editor state
 * @param text - Text to insert
 * @returns New editor state with text inserted and cursor advanced
 */
export function insertAtCursor(state: EditorState, text: string): EditorState {
  const { value, cursorIndex } = state;
  const before = value.slice(0, cursorIndex);
  const after = value.slice(cursorIndex);

  return {
    value: before + text + after,
    cursorIndex: cursorIndex + text.length,
  };
}

/**
 * Delete character before cursor (backspace).
 *
 * @param state - Current editor state
 * @returns New editor state with character deleted
 */
export function deleteBackward(state: EditorState): EditorState {
  const { value, cursorIndex } = state;

  if (cursorIndex === 0) {
    return state; // Nothing to delete
  }

  const before = value.slice(0, cursorIndex - 1);
  const after = value.slice(cursorIndex);

  return {
    value: before + after,
    cursorIndex: cursorIndex - 1,
  };
}

/**
 * Delete character at cursor (delete key).
 *
 * @param state - Current editor state
 * @returns New editor state with character deleted
 */
export function deleteForward(state: EditorState): EditorState {
  const { value, cursorIndex } = state;

  if (cursorIndex >= value.length) {
    return state; // Nothing to delete
  }

  const before = value.slice(0, cursorIndex);
  const after = value.slice(cursorIndex + 1);

  return {
    value: before + after,
    cursorIndex, // Cursor stays at same position
  };
}

/**
 * Move cursor left or right.
 *
 * @param state - Current editor state
 * @param direction - 'left' or 'right'
 * @returns New editor state with cursor moved
 */
export function moveCursor(
  state: EditorState,
  direction: 'left' | 'right'
): EditorState {
  const { value, cursorIndex } = state;

  if (direction === 'left') {
    return {
      value,
      cursorIndex: Math.max(0, cursorIndex - 1),
    };
  } else {
    return {
      value,
      cursorIndex: Math.min(value.length, cursorIndex + 1),
    };
  }
}

/**
 * Move cursor to start or end of input.
 *
 * @param state - Current editor state
 * @param position - 'start' or 'end'
 * @returns New editor state with cursor at boundary
 */
export function moveCursorToBoundary(
  state: EditorState,
  position: 'start' | 'end'
): EditorState {
  const { value } = state;

  return {
    value,
    cursorIndex: position === 'start' ? 0 : value.length,
  };
}

/**
 * Set cursor to specific index (clamped to valid range).
 *
 * @param state - Current editor state
 * @param index - Desired cursor index
 * @returns New editor state with cursor at index
 */
export function setCursor(state: EditorState, index: number): EditorState {
  const { value } = state;

  return {
    value,
    cursorIndex: Math.max(0, Math.min(value.length, index)),
  };
}

/**
 * Replace entire value and move cursor to end.
 *
 * @param state - Current editor state
 * @param newValue - New value
 * @returns New editor state
 */
export function setValue(state: EditorState, newValue: string): EditorState {
  return {
    value: newValue,
    cursorIndex: newValue.length,
  };
}

/**
 * Render value with cursor marker inserted at cursor position.
 *
 * @param value - Current input value
 * @param cursorIndex - Current cursor position
 * @param cursorChar - Character to use for cursor (default: '|')
 * @returns Display string with cursor marker
 */
export function renderWithCursor(
  value: string,
  cursorIndex: number,
  cursorChar: string = '|'
): string {
  const clampedIndex = Math.max(0, Math.min(value.length, cursorIndex));

  const before = value.slice(0, clampedIndex);
  const after = value.slice(clampedIndex);

  return before + cursorChar + after;
}

/**
 * Get visual display for multi-line input with cursor.
 *
 * For single-line: shows full value with cursor
 * For multi-line: shows first line + line count + cursor indicator
 *
 * @param state - Current editor state
 * @returns Display info
 */
export function getDisplayWithCursor(state: EditorState): {
  display: string;
  isMultiLine: boolean;
  lineCount: number;
} {
  const { value, cursorIndex } = state;
  const lines = value.split('\n');
  const isMultiLine = lines.length > 1;

  if (!isMultiLine) {
    // Single line: render with cursor
    return {
      display: renderWithCursor(value, cursorIndex),
      isMultiLine: false,
      lineCount: 1,
    };
  }

  // Multi-line: show a compact preview that always includes a visible cursor marker.
  // We display:
  // - first line + line count
  // - the current cursor line (with cursor inserted) if cursor is not on line 1
  let lineStartIndex = 0;
  let cursorLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineEndIndex = lineStartIndex + lines[i].length;

    if (cursorIndex <= lineEndIndex) {
      cursorLine = i;
      break;
    }

    // Skip newline character between lines
    lineStartIndex = lineEndIndex + 1;
  }

  const cursorColumnIndex = Math.max(
    0,
    Math.min(lines[cursorLine].length, cursorIndex - lineStartIndex)
  );

  const summary = `${lines[0]}... [${lines.length} lines]`;
  const cursorLineDisplay = renderWithCursor(lines[cursorLine], cursorColumnIndex);

  const display =
    cursorLine === 0
      ? `${cursorLineDisplay}... [${lines.length} lines]`
      : `${summary}\n(line ${cursorLine + 1}) ${cursorLineDisplay}`;

  return {
    display,
    isMultiLine: true,
    lineCount: lines.length,
  };
}
