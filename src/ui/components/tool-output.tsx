import React, { memo } from 'react';
import { Box, Text } from 'ink';

interface ToolOutputProps {
  toolName: string;
  result: unknown;
}

// Memoized to prevent re-renders when tool output hasn't changed
export const ToolOutput = memo(function ToolOutput({ toolName, result }: ToolOutputProps) {
  const isRunning = result === 'running...';
  const resultObj = result as { success?: boolean; output?: string; error?: string };
  const success = resultObj?.success ?? false;

  return (
    <Box marginY={1} flexDirection="column">
      <Box>
        <Text color="yellow">[{toolName}] </Text>
        {isRunning ? (
          <Text color="gray">running...</Text>
        ) : success ? (
          <Text color="green">completed</Text>
        ) : (
          <Text color="red">failed</Text>
        )}
      </Box>
      {!isRunning && resultObj?.output && (
        <Box marginLeft={2}>
          <Text color="gray" wrap="wrap">
            {resultObj.output.slice(0, 500)}
            {resultObj.output.length > 500 ? '...' : ''}
          </Text>
        </Box>
      )}
      {!isRunning && resultObj?.error && (
        <Box marginLeft={2}>
          <Text color="red">{resultObj.error}</Text>
        </Box>
      )}
    </Box>
  );
});
