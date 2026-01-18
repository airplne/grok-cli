import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { formatToolOutput } from '../utils/format-tool-output.js';

interface ToolOutputProps {
  toolName: string;
  result: unknown;
  /** Whether this tool output is currently selected for navigation */
  selected?: boolean;
  /** Whether this tool output is expanded to show full content */
  expanded?: boolean;
}

// Memoized to prevent re-renders when tool output hasn't changed
export const ToolOutput = memo(function ToolOutput({
  toolName,
  result,
  selected = false,
  expanded = false,
}: ToolOutputProps) {
  const isRunning = result === 'running...';
  const resultObj = result as { success?: boolean; output?: string; error?: string };
  const success = resultObj?.success ?? false;

  // Format output with head+tail truncation (unless expanded)
  const formattedOutput = resultObj?.output
    ? expanded
      ? { text: resultObj.output, truncated: false, originalLength: resultObj.output.length, hiddenChars: 0 }
      : formatToolOutput(resultObj.output)
    : null;

  // Selection indicator
  const selectionIndicator = selected ? '>' : ' ';
  const borderColor = selected ? 'cyan' : undefined;

  return (
    <Box
      marginY={1}
      flexDirection="column"
      borderStyle={selected ? 'round' : undefined}
      borderColor={borderColor}
      paddingX={selected ? 1 : 0}
    >
      <Box>
        {/* Selection indicator */}
        <Text color={selected ? 'cyan' : 'gray'}>{selectionIndicator} </Text>
        <Text color="yellow">[{toolName}] </Text>
        {isRunning ? (
          <Text color="gray">running...</Text>
        ) : success ? (
          <Text color="green">completed</Text>
        ) : (
          <Text color="red">failed</Text>
        )}
        {/* Expand/collapse hint when selected */}
        {selected && !isRunning && formattedOutput && (
          <Text color="gray">
            {' '}
            {expanded ? '[EXPANDED - press e to collapse]' : '[press e to expand]'}
          </Text>
        )}
      </Box>

      {/* Output content */}
      {!isRunning && formattedOutput && (
        <Box marginLeft={2} flexDirection="column">
          <Text color="gray" wrap="wrap">
            {formattedOutput.text}
          </Text>
          {/* Truncation indicator */}
          {formattedOutput.truncated && !expanded && (
            <Box marginTop={1}>
              <Text color="yellow" dimColor>
                [Truncated: {formattedOutput.hiddenChars.toLocaleString()} chars hidden. Press 'e' to expand.]
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Error display */}
      {!isRunning && resultObj?.error && (
        <Box marginLeft={2}>
          <Text color="red">{resultObj.error}</Text>
        </Box>
      )}
    </Box>
  );
});
