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
  const [debugMode, setDebugMode] = useState(false);
  const [lastKeyEvent, setLastKeyEvent] = useState<{ input: string; flags: string } | null>(null);

  useInput((input, key) => {
    // Debug mode: capture key events for diagnostics
    if (debugMode) {
      const flags = [
        key.tab ? 'tab' : null,
        (key as any).shift ? 'shift' : null,
        key.return ? 'return' : null,
        key.escape ? 'escape' : null,
        key.upArrow ? 'up' : null,
        key.downArrow ? 'down' : null,
      ].filter(Boolean).join(',') || 'none';

      const escaped = input
        .split('')
        .map(c => {
          const code = c.charCodeAt(0);
          if (code < 32 || code === 127) {
            return `\\x${code.toString(16).padStart(2, '0')}`;
          }
          return c;
        })
        .join('');

      setLastKeyEvent({ input: escaped || '(empty)', flags });
    }

    // Toggle debug mode with '?' key
    if (input === '?') {
      setDebugMode(prev => !prev);
      return;
    }

    // Shift+Tab handling varies across terminals:
    // - Some send ESC [ Z
    // - Some send ESC [ 1 ; 2 Z
    // - Some terminals split ESC, leaving "[Z" / "[1;2Z"
    // - Some set key.tab + key.shift
    // - SS3 variant: ESC O Z (may arrive as 'OZ' after Ink strips ESC)
    const isShiftTab =
      input === '\x1b[Z' ||
      input === '\x1b[1;2Z' ||
      input === '[Z' ||
      input === '[1;2Z' ||
      input === 'OZ' || // SS3 fallback (ESC O Z with ESC stripped)
      input === '\x1bOZ' || // SS3 with ESC
      (key.tab && (key as any).shift);

    if (isShiftTab) {
      setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
      return;
    }

    // Tab: cycle forward
    if (key.tab || input === '\t') {
      setSelectedIndex(prev => (prev + 1) % options.length);
      return;
    }

    // Arrow keys: alternative navigation
    if (key.upArrow) {
      setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => (prev + 1) % options.length);
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
          Tab/Shift+Tab/↑/↓: navigate • Enter/letter: select • Esc: deny
          {!debugMode && ' • ?: debug'}
        </Text>
      </Box>

      {/* Debug overlay */}
      {debugMode && lastKeyEvent && (
        <Box marginTop={1} borderStyle="single" borderColor="magenta" paddingX={1}>
          <Text color="magenta" dimColor>
            DEBUG: input="{lastKeyEvent.input}" flags=[{lastKeyEvent.flags}]
          </Text>
        </Box>
      )}
    </Box>
  );
}
