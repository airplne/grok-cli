import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getConfirmOptions, ConfirmDecision } from '../utils/confirm-decision.js';

interface ConfirmDialogProps {
  toolName: string;
  args: Record<string, unknown>;
  onResponse: (decision: ConfirmDecision) => void;
  autoAcceptEdits?: boolean;
}

export function ConfirmDialog({
  toolName,
  args,
  onResponse,
  autoAcceptEdits = false,
}: ConfirmDialogProps) {
  const options = getConfirmOptions(toolName);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    // Tab: cycle forward
    if (key.tab) {
      setSelectedIndex(prev => (prev + 1) % options.length);
      return;
    }

    // Shift+Tab: cycle backward
    if (input === '\x1b[Z') {
      setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
      return;
    }

    // Enter: select current option
    if (key.return) {
      onResponse(options[selectedIndex].decision);
      return;
    }

    // Letter shortcuts (y/a/n)
    const inputLower = input.toLowerCase();
    const matchedOption = options.find(o => o.key === inputLower);
    if (matchedOption) {
      onResponse(matchedOption.decision);
      return;
    }

    // Escape: deny (optional convenience)
    if (key.escape) {
      onResponse('deny');
      return;
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>Permission Required</Text>

      {/* Auto-accept status indicator */}
      {autoAcceptEdits && (
        <Box marginTop={1}>
          <Text color="cyan" dimColor>
            Auto-accept edits: ENABLED (session)
          </Text>
        </Box>
      )}

      <Box marginY={1}>
        <Text>Tool: </Text>
        <Text color="cyan" bold>{toolName}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">{JSON.stringify(args, null, 2).slice(0, 200)}</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginTop={1}>
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={option.key}>
              <Text color={isSelected ? 'cyan' : 'gray'} bold={isSelected}>
                {isSelected ? '▶ ' : '  '}
              </Text>
              <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                [{option.key}] {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Help hint */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Tab/Shift+Tab: navigate • Enter/letter: select • Esc: deny
        </Text>
      </Box>
    </Box>
  );
}
