import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ConfirmDialogProps {
  toolName: string;
  args: Record<string, unknown>;
  onResponse: (approved: boolean) => void;
}

export function ConfirmDialog({ toolName, args, onResponse }: ConfirmDialogProps) {
  useInput((input) => {
    if (input.toLowerCase() === 'y') {
      onResponse(true);
    } else if (input.toLowerCase() === 'n' || input === '\r') {
      onResponse(false);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>Permission Required</Text>
      <Box marginY={1}>
        <Text>Tool: </Text>
        <Text color="cyan" bold>{toolName}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="gray">{JSON.stringify(args, null, 2).slice(0, 200)}</Text>
      </Box>
      <Box>
        <Text>Allow? </Text>
        <Text color="green">[y]es</Text>
        <Text> / </Text>
        <Text color="red">[n]o</Text>
      </Box>
    </Box>
  );
}
