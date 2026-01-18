/**
 * Bracketed Paste Mode Utilities
 *
 * Handles terminal bracketed paste sequences to enable multi-line paste
 * without premature submission.
 *
 * When bracketed paste mode is enabled, terminals wrap pasted text with:
 * - Start: \x1b[200~
 * - End: \x1b[201~
 *
 * This allows applications to distinguish typed input from pasted input.
 */

export const PASTE_START = '\x1b[200~';
export const PASTE_END = '\x1b[201~';

/**
 * State machine for bracketed paste handling
 */
export interface PasteState {
  isPasting: boolean;
  buffer: string;
}

/**
 * Result of processing stdin data
 */
export interface ProcessResult {
  /** Updated paste state */
  state: PasteState;
  /** Content to append to input value (if paste completed or not pasting) */
  contentToAppend: string | null;
  /** Whether this data should be handled by useInput (false if paste-related) */
  handleByUseInput: boolean;
}

/**
 * Process stdin data and handle bracketed paste sequences.
 *
 * @param data - Raw stdin buffer data
 * @param currentState - Current paste state
 * @returns ProcessResult with updated state and content to append
 */
export function processPasteData(data: string, currentState: PasteState): ProcessResult {
  const { isPasting, buffer } = currentState;

  // Check for paste start sequence
  if (data.includes(PASTE_START)) {
    const afterStart = data.split(PASTE_START)[1] || '';

    if (afterStart.includes(PASTE_END)) {
      // Paste ended in same chunk
      const pastedContent = afterStart.split(PASTE_END)[0];
      return {
        state: { isPasting: false, buffer: '' },
        contentToAppend: pastedContent,
        handleByUseInput: false,
      };
    }

    // Paste started but not ended
    return {
      state: { isPasting: true, buffer: afterStart },
      contentToAppend: null,
      handleByUseInput: false,
    };
  }

  // Check for paste end sequence
  if (isPasting && data.includes(PASTE_END)) {
    const beforeEnd = data.split(PASTE_END)[0];
    const fullPaste = buffer + beforeEnd;

    return {
      state: { isPasting: false, buffer: '' },
      contentToAppend: fullPaste,
      handleByUseInput: false,
    };
  }

  // Continue accumulating paste content
  if (isPasting) {
    return {
      state: { isPasting: true, buffer: buffer + data },
      contentToAppend: null,
      handleByUseInput: false,
    };
  }

  // Not a paste-related sequence - let useInput handle it
  return {
    state: currentState,
    contentToAppend: null,
    handleByUseInput: true,
  };
}

/**
 * Get display value for multi-line input.
 * Shows first line with a line count indicator.
 *
 * @param value - Current input value
 * @returns Display string
 */
export function getMultiLineDisplay(value: string): {
  display: string;
  isMultiLine: boolean;
  lineCount: number;
} {
  const lines = value.split('\n');
  const isMultiLine = lines.length > 1;

  const display = isMultiLine
    ? `${lines[0]}... [${lines.length} lines]`
    : value;

  return {
    display,
    isMultiLine,
    lineCount: lines.length,
  };
}
