import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import {
  PASTE_START,
  PASTE_END,
  PasteState,
  processPasteData,
  getMultiLineDisplay,
} from '../utils/bracketed-paste.js';
import { getCommandSuggestions } from '../utils/command-suggestions.js';
import { CommandPalette } from './command-palette.js';
import { getRegistry } from '../../commands/index.js';

interface InputPromptProps {
  onSubmit: (value: string) => void;
  isActive?: boolean;
  onPaletteVisibilityChange?: (visible: boolean) => void;
}

export function InputPrompt({ onSubmit, isActive = true, onPaletteVisibilityChange }: InputPromptProps) {
  const [value, setValue] = useState('');
  const [pasteState, setPasteState] = useState<PasteState>({ isPasting: false, buffer: '' });
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [paletteDismissed, setPaletteDismissed] = useState(false);
  const { stdin } = useStdin();

  // Get available commands for suggestions
  const commands = useMemo(() => getRegistry().getAllCommands(), []);

  // Compute suggestions based on current input
  const suggestions = useMemo(() => {
    // Don't show palette during paste or if not active
    if (pasteState.isPasting || !isActive) {
      return [];
    }

    return getCommandSuggestions(value, commands);
  }, [value, commands, pasteState.isPasting, isActive]);

  // Only show palette while editing the command token (before first space)
  const isEditingCommand = value.startsWith('/') && !value.includes(' ');
  const showPalette = isEditingCommand && suggestions.length > 0 && !paletteDismissed;

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [suggestions.length]);

  // Notify parent when palette visibility changes
  useEffect(() => {
    onPaletteVisibilityChange?.(showPalette);
  }, [showPalette, onPaletteVisibilityChange]);

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

    // Command palette keyboard handling (when visible)
    if (showPalette) {
      // Navigate down
      if (key.downArrow) {
        setSelectedSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }

      // Navigate up
      if (key.upArrow) {
        setSelectedSuggestionIndex(prev => Math.max(prev - 1, 0));
        return;
      }

      // Tab: autocomplete selected suggestion
      if (key.tab) {
        const selected = suggestions[selectedSuggestionIndex];
        if (selected) {
          const commandName = selected.command.name;
          // Extract args portion (if any)
          const parts = value.split(' ');
          const args = parts.slice(1).join(' ');
          // Replace command portion with selected, preserve args
          setValue(`/${commandName}${args ? ' ' + args : ' '}`);
          setPaletteDismissed(false); // Palette will auto-hide due to space
        }
        return;
      }

      // Escape: close palette
      if (key.escape) {
        setPaletteDismissed(true);
        setSelectedSuggestionIndex(0);
        return;
      }
    }

    // Regular input handling
    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue('');
        setSelectedSuggestionIndex(0);
        setPaletteDismissed(false); // Reset for next command
      }
    } else if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
      setPaletteDismissed(false); // Re-show palette on editing
    } else if (!key.ctrl && !key.meta && input && !key.tab) {
      // Filter out escape sequences that might slip through
      if (!input.startsWith('\x1b')) {
        setValue(prev => prev + input);
        setPaletteDismissed(false); // Re-show palette on typing
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

      {/* Command palette (when input starts with /) */}
      {showPalette && (
        <CommandPalette
          suggestions={suggestions}
          selectedIndex={selectedSuggestionIndex}
        />
      )}
    </Box>
  );
}
