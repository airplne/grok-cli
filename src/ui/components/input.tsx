import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputPromptProps {
  onSubmit: (value: string) => void;
}

export function InputPrompt({ onSubmit }: InputPromptProps) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue('');
      }
    } else if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      setValue(prev => prev + input);
    }
  });

  return (
    <Box marginTop={1}>
      <Text color="blue" bold>&gt; </Text>
      <Text>{value}</Text>
      <Text color="gray">|</Text>
    </Box>
  );
}
