import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import {
  PASTE_START,
  PASTE_END,
  PasteState,
  processPasteData,
  getMultiLineDisplay,
} from '../utils/bracketed-paste.js';

interface InputPromptProps {
  onSubmit: (value: string) => void;
  isActive?: boolean;
}

export function InputPrompt({ onSubmit, isActive = true }: InputPromptProps) {
  const [value, setValue] = useState('');
  const [pasteState, setPasteState] = useState<PasteState>({ isPasting: false, buffer: '' });
  const { stdin } = useStdin();

  // Enable bracketed paste mode when component mounts
  useEffect(() => {
    if (!stdin || !isActive) return;

    // Enable bracketed paste mode
    process.stdout.write('\x1b[?2004h');

    return () => {
      // Disable bracketed paste mode on unmount
      process.stdout.write('\x1b[?2004l');
    };
  }, [stdin, isActive]);

  // Handle raw stdin for bracketed paste detection
  useEffect(() => {
    if (!stdin || !isActive) return;

    const handleData = (data: Buffer) => {
      const str = data.toString();
      const result = processPasteData(str, pasteState);

      // Update paste state
      if (result.state !== pasteState) {
        setPasteState(result.state);
      }

      // Append completed paste content
      if (result.contentToAppend !== null) {
        setValue(prev => prev + result.contentToAppend);
      }
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin, isActive, pasteState]);

  useInput((input, key) => {
    // Don't process input during paste (handled by raw stdin listener)
    if (pasteState.isPasting) return;

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue('');
      }
    } else if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      // Filter out escape sequences that might slip through
      if (!input.startsWith('\x1b')) {
        setValue(prev => prev + input);
      }
    }
  }, { isActive });

  // Get display representation
  const { display, isMultiLine, lineCount } = getMultiLineDisplay(value);

  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color="blue" bold>&gt; </Text>
        <Text>{display}</Text>
        <Text color="gray" dimColor={!isActive}>
          {pasteState.isPasting ? ' [pasting...]' : '|'}
        </Text>
      </Box>
      {isMultiLine && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            (multi-line prompt: {value.length} chars)
          </Text>
        </Box>
      )}
    </Box>
  );
}
