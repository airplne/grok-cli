import React, { memo } from 'react';
import { Box, Text } from 'ink';
import type { CommandSuggestion } from '../utils/command-suggestions.js';

interface CommandPaletteProps {
  suggestions: CommandSuggestion[];
  selectedIndex: number;
}

/**
 * Command Palette Component
 *
 * Displays filtered command suggestions below the input prompt.
 * Shows command name, description, aliases, and usage.
 */
export const CommandPalette = memo(function CommandPalette({
  suggestions,
  selectedIndex,
}: CommandPaletteProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text color="cyan" bold>
          Commands
        </Text>
        <Text color="gray" dimColor>
          {' '}({suggestions.length} {suggestions.length === 1 ? 'match' : 'matches'})
        </Text>
      </Box>

      {/* Suggestions list */}
      <Box flexDirection="column">
        {suggestions.map((suggestion, index) => {
          const isSelected = index === selectedIndex;
          const { command, matchedAlias } = suggestion;

          return (
            <Box
              key={command.name}
              paddingX={1}
              paddingY={0}
            >
              {/* Selection indicator */}
              <Text color="cyan" bold={isSelected}>
                {isSelected ? '▶ ' : '  '}
              </Text>

              {/* Command name */}
              <Text color="cyan" bold={isSelected} inverse={isSelected}>
                /{command.name}
              </Text>

              {/* Matched alias indicator */}
              {matchedAlias && (
                <Text color="yellow" bold={isSelected}>
                  {' '}(via {matchedAlias})
                </Text>
              )}

              {/* Description */}
              <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                {' '}- {command.description}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Help hint */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Tab: autocomplete • ↑/↓: navigate • Esc: close • Enter: submit
        </Text>
      </Box>
    </Box>
  );
});
