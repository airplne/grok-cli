import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface SpinnerProps {
  text?: string;
}

const frames = ['|', '/', '-', '\\'];

export function Spinner({ text = 'Loading...' }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box>
      <Text color="cyan">{frames[frame]} </Text>
      <Text color="gray">{text}</Text>
    </Box>
  );
}
