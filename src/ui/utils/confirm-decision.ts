/**
 * Confirmation Decision Logic
 *
 * Pure functions for determining auto-approval and confirmation options.
 * Used by the confirmation dialog and app-level permission handling.
 */

export type ConfirmDecision = 'allow_once' | 'auto_accept_edits' | 'deny';

export interface ConfirmOption {
  key: string;
  label: string;
  decision: ConfirmDecision;
}

/**
 * Tools that are eligible for auto-accept edits feature.
 * Bash is explicitly excluded (always requires confirmation).
 */
const AUTO_ACCEPT_ELIGIBLE_TOOLS = ['Edit', 'Write'];

/**
 * Determine if a tool call should be auto-approved without showing dialog.
 *
 * @param toolName - Name of the tool being called
 * @param autoAcceptEdits - Whether auto-accept edits is enabled (session state)
 * @returns true if should auto-approve, false if dialog should be shown
 */
export function shouldAutoApprove(toolName: string, autoAcceptEdits: boolean): boolean {
  if (!autoAcceptEdits) {
    return false; // Feature disabled
  }

  return AUTO_ACCEPT_ELIGIBLE_TOOLS.includes(toolName);
}

/**
 * Get confirmation options for a specific tool.
 *
 * Edit/Write tools include "Auto-accept edits (session)" option.
 * Bash and other tools only show "Allow once" and "Deny".
 *
 * @param toolName - Name of the tool requiring confirmation
 * @returns Array of confirmation options
 */
export function getConfirmOptions(toolName: string): ConfirmOption[] {
  const baseOptions: ConfirmOption[] = [
    {
      key: 'y',
      label: 'Allow once',
      decision: 'allow_once',
    },
  ];

  // Add auto-accept option for Edit/Write
  if (AUTO_ACCEPT_ELIGIBLE_TOOLS.includes(toolName)) {
    baseOptions.push({
      key: 'a',
      label: 'Auto-accept edits (session)',
      decision: 'auto_accept_edits',
    });
  }

  baseOptions.push({
    key: 'n',
    label: 'Deny',
    decision: 'deny',
  });

  return baseOptions;
}

/**
 * Check if a tool is eligible for auto-accept edits.
 * Used for validation and UI logic.
 *
 * @param toolName - Name of the tool
 * @returns true if tool can be auto-accepted
 */
export function isAutoAcceptEligible(toolName: string): boolean {
  return AUTO_ACCEPT_ELIGIBLE_TOOLS.includes(toolName);
}
