import React, { memo } from 'react';
import { Box, Text } from 'ink';

interface MessageDisplayProps {
  role: string;
  content: string;
}

/**
 * Check if content is a system-generated evidence block.
 * Evidence blocks start with "=== EVIDENCE ===" and contain tool execution stats.
 */
function isEvidenceBlock(content: string): boolean {
  return content.trim().startsWith('=== EVIDENCE ===');
}

/**
 * Get display properties based on message role and content.
 */
function getMessageDisplay(role: string, content: string): {
  label: string;
  labelColor: string;
  borderStyle?: 'round' | 'single' | 'double' | 'bold';
  borderColor?: string;
  contentColor?: string;
} {
  if (role === 'user') {
    return { label: 'You', labelColor: 'blue' };
  }

  if (role === 'system') {
    // Evidence blocks get special treatment
    if (isEvidenceBlock(content)) {
      return {
        label: 'Evidence (system-verified)',
        labelColor: 'magenta',
        borderStyle: 'round',
        borderColor: 'magenta',
        contentColor: 'magenta',
      };
    }

    // Other system messages
    return {
      label: 'System',
      labelColor: 'yellow',
      borderStyle: 'single',
      borderColor: 'yellow',
    };
  }

  // Assistant messages
  return { label: 'Grok', labelColor: 'green' };
}

// React.memo prevents re-renders when props haven't changed
export const MessageDisplay = memo(function MessageDisplay({ role, content }: MessageDisplayProps) {
  const display = getMessageDisplay(role, content);

  // Evidence and system messages get a bordered box for visual distinction
  if (display.borderStyle) {
    return (
      <Box marginY={1} flexDirection="column">
        <Box
          borderStyle={display.borderStyle}
          borderColor={display.borderColor}
          paddingX={1}
          flexDirection="column"
        >
          <Text color={display.labelColor} bold>
            {display.label}
          </Text>
          <Box marginTop={1}>
            <Text color={display.contentColor} wrap="wrap">
              {content}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Regular messages (user, assistant)
  return (
    <Box marginY={1} flexDirection="column">
      <Text color={display.labelColor} bold>
        {display.label}
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
});
