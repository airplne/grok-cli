/**
 * Tool Output Formatter
 *
 * Provides head+tail truncation for long tool outputs while preserving
 * critical sections like the === EVIDENCE === block at the end.
 */

export interface FormatOptions {
  /** Maximum total characters before truncation (default: 20000) */
  maxChars?: number;
  /** Characters to show from the beginning (default: 8000) */
  headChars?: number;
  /** Characters to show from the end (default: 8000) */
  tailChars?: number;
}

export interface FormatResult {
  /** The formatted text (truncated or full) */
  text: string;
  /** Whether truncation was applied */
  truncated: boolean;
  /** Original length in characters */
  originalLength: number;
  /** Number of characters hidden (0 if not truncated) */
  hiddenChars: number;
}

const DEFAULT_MAX_CHARS = 20000;
const DEFAULT_HEAD_CHARS = 8000;
const DEFAULT_TAIL_CHARS = 8000;

/**
 * Format tool output with head+tail truncation.
 *
 * When output exceeds maxChars, shows:
 * - First `headChars` characters
 * - A truncation banner with stats
 * - Last `tailChars` characters (preserving evidence blocks)
 *
 * @param output - Raw tool output string
 * @param options - Truncation thresholds
 * @returns Formatted result with truncation metadata
 */
export function formatToolOutput(
  output: string,
  options: FormatOptions = {}
): FormatResult {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const headChars = options.headChars ?? DEFAULT_HEAD_CHARS;
  const tailChars = options.tailChars ?? DEFAULT_TAIL_CHARS;

  const originalLength = output.length;

  // No truncation needed
  if (originalLength <= maxChars) {
    return {
      text: output,
      truncated: false,
      originalLength,
      hiddenChars: 0,
    };
  }

  // Calculate how much we're hiding
  const hiddenChars = originalLength - headChars - tailChars;

  // Edge case: if head + tail would overlap, just show full output
  if (hiddenChars <= 0) {
    return {
      text: output,
      truncated: false,
      originalLength,
      hiddenChars: 0,
    };
  }

  const head = output.slice(0, headChars);
  const tail = output.slice(-tailChars);

  const banner = [
    '',
    `[... ${hiddenChars.toLocaleString()} chars hidden; total ${originalLength.toLocaleString()} chars; showing first ${headChars.toLocaleString()} + last ${tailChars.toLocaleString()} ...]`,
    '',
  ].join('\n');

  return {
    text: head + banner + tail,
    truncated: true,
    originalLength,
    hiddenChars,
  };
}

/**
 * Check if output contains an evidence block.
 * Useful for testing that evidence is preserved after truncation.
 */
export function containsEvidenceBlock(text: string): boolean {
  return text.includes('=== EVIDENCE ===');
}
