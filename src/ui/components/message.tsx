import React, { memo } from 'react';
import { Box, Text } from 'ink';

interface MessageDisplayProps {
  role: string;
  content: string;
}

// React.memo prevents re-renders when props haven't changed
export const MessageDisplay = memo(function MessageDisplay({ role, content }: MessageDisplayProps) {
  const isUser = role === 'user';

  return (
    <Box marginY={1} flexDirection="column">
      <Text color={isUser ? 'blue' : 'green'} bold>
        {isUser ? 'You' : 'Grok'}
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
});
