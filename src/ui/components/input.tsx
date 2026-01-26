import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import {
  PASTE_START,
  PASTE_END,
  PasteState,
  processPasteData,
} from '../utils/bracketed-paste.js';
import {
  createEditorState,
  insertAtCursor,
  deleteBackward,
  deleteForward,
  moveCursor,
  moveCursorToBoundary,
  setValue,
  getDisplayWithCursor,
  EditorState,
} from '../utils/input-editor.js';
import { getCommandSuggestions } from '../utils/command-suggestions.js';
import { CommandPalette } from './command-palette.js';
import { getRegistry } from '../../commands/index.js';
import { containsPasteMarkers } from '../../commands/utils.js';

interface InputPromptProps {
  onSubmit: (value: string) => void;
  isActive?: boolean;
  onPaletteVisibilityChange?: (visible: boolean) => void;
}

export function InputPrompt({ onSubmit, isActive = true, onPaletteVisibilityChange }: InputPromptProps) {
  const [editorState, setEditorState] = useState<EditorState>(createEditorState());
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

    return getCommandSuggestions(editorState.value, commands);
  }, [editorState.value, commands, pasteState.isPasting, isActive]);

  // Only show palette while editing the command token (before first space)
  const isEditingCommand = editorState.value.startsWith('/') && !editorState.value.includes(' ');
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

      // Append completed paste content at cursor
      if (result.contentToAppend !== null) {
        setEditorState(prev => insertAtCursor(prev, result.contentToAppend!));
        setPaletteDismissed(false);
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
          const parts = editorState.value.split(' ');
          const args = parts.slice(1).join(' ');
          // Replace command portion with selected, preserve args
          setEditorState(setValue(editorState, `/${commandName}${args ? ' ' + args : ' '}`));
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

    // Cursor movement (left/right arrows, Home/End).
    // Palette uses ↑/↓; left/right and Home/End are safe to use even when palette is visible.
    // Home/End support varies by terminal; handle both Ink keys and common escape sequences.
    const isHome = (key as any).home || input === '\x1b[H' || input === '\x1bOH' || input === '\x1b[1~';
    const isEnd = (key as any).end || input === '\x1b[F' || input === '\x1bOF' || input === '\x1b[4~';

    if (isHome) {
      setEditorState(prev => moveCursorToBoundary(prev, 'start'));
      return;
    }

    if (isEnd) {
      setEditorState(prev => moveCursorToBoundary(prev, 'end'));
      return;
    }

    if (key.leftArrow || input === '\x1b[D' || input === '\x1bOD') {
      setEditorState(prev => moveCursor(prev, 'left'));
      return;
    }

    if (key.rightArrow || input === '\x1b[C' || input === '\x1bOC') {
      setEditorState(prev => moveCursor(prev, 'right'));
      return;
    }

    // Regular input handling
    if (key.return) {
      if (editorState.value.trim()) {
        onSubmit(editorState.value.trim());
        setEditorState(createEditorState());
        setSelectedSuggestionIndex(0);
        setPaletteDismissed(false);
      }
      return;
    }

    // Backspace: detect both Ink flag and common byte codes
    // Pop!_OS/tmux may send \x7f (DEL) or \b (BS) without setting key.backspace
    const isBackspace =
      key.backspace ||
      input === '\x7f' ||  // DEL (most common)
      input === '\b' ||    // BS
      input === '\x08';    // Control-H

    if (isBackspace) {
      setEditorState(prev => deleteBackward(prev));
      setPaletteDismissed(false);
      return;
    }

    // Delete: detect both Ink flag and terminal sequences
    const isDelete =
      key.delete ||
      input === '\x1b[3~' ||  // Standard delete sequence
      input === '[3~';         // ESC-stripped variant

    if (isDelete) {
      setEditorState(prev => deleteForward(prev));
      setPaletteDismissed(false);
      return;
    }

    // Text insertion: only for printable characters
    // Explicitly exclude control characters that might slip through
    if (!key.ctrl && !key.meta && input && !key.tab) {
      // Filter out:
      // - Escape sequences
      // - Bracketed paste markers
      // - Control characters (< 0x20, except tab which is already filtered)
      const hasControlChars = input.split('').some(c => {
        const code = c.charCodeAt(0);
        return code < 32 && code !== 9; // Allow tab (9) but block other control chars
      });

      if (!input.startsWith('\x1b') && !containsPasteMarkers(input) && !hasControlChars) {
        setEditorState(prev => insertAtCursor(prev, input));
        setPaletteDismissed(false);
      }
    }
  }, { isActive });

  // Get display representation
  const displayInfo = getDisplayWithCursor(editorState);

  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color="blue" bold>&gt; </Text>
        <Text>{displayInfo.display}</Text>
        <Text color="gray" dimColor={!isActive}>
          {pasteState.isPasting ? ' [pasting...]' : ''}
        </Text>
      </Box>
      {displayInfo.isMultiLine && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            (multi-line prompt: {editorState.value.length} chars)
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
