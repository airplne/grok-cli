/**
 * Command Utilities
 *
 * Shared utilities for command processing, including control sequence sanitization.
 */

/**
 * Remove control sequences from user input.
 *
 * Removes:
 * - Bracketed paste markers: \x1b[200~, \x1b[201~, [200~, [201~
 * - General ANSI/VT control sequences: \x1b[...
 *
 * This prevents terminal control codes from corrupting command arguments,
 * especially file paths in commands like /prompt.
 *
 * @param input - Raw user input that may contain control sequences
 * @returns Sanitized string with control sequences removed
 */
export function sanitizeControlSequences(input: string): string {
  let sanitized = input;

  // Remove bracketed paste markers (with ESC prefix)
  sanitized = sanitized.replace(/\x1b\[200~/g, '');
  sanitized = sanitized.replace(/\x1b\[201~/g, '');

  // Remove bracketed paste markers (ESC-stripped variants)
  // These can appear when terminals split the ESC from the sequence
  sanitized = sanitized.replace(/\[200~/g, '');
  sanitized = sanitized.replace(/\[201~/g, '');

  // Remove general ANSI/VT control sequences
  // Pattern: ESC [ followed by numbers/semicolons, ending with a letter
  // Examples: \x1b[0m (reset), \x1b[1;32m (bold green), \x1b[2J (clear screen)
  sanitized = sanitized.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  // Remove other common ESC sequences (OSC, CSI variants)
  sanitized = sanitized.replace(/\x1b\][0-9;]*[^\x07]*\x07/g, ''); // OSC sequences
  sanitized = sanitized.replace(/\x1bO[A-Z]/g, ''); // SS3 sequences

  return sanitized;
}

/**
 * Check if a string contains bracketed paste markers.
 * Useful for debugging and testing.
 *
 * @param input - String to check
 * @returns true if bracketed paste markers are present
 */
export function containsPasteMarkers(input: string): boolean {
  return (
    input.includes('\x1b[200~') ||
    input.includes('\x1b[201~') ||
    input.includes('[200~') ||
    input.includes('[201~')
  );
}
