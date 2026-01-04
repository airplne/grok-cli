import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { TodoItem } from '../../tools/todo.js';

interface TodoDisplayProps {
  todos: TodoItem[];
}

// Memoized - only re-renders when todos array changes
export const TodoDisplay = memo(function TodoDisplay({ todos }: TodoDisplayProps) {
  if (todos.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1} marginBottom={1}>
      <Text color="gray" bold>Tasks</Text>
      {todos.map((todo, i) => (
        <Box key={`todo-${i}-${todo.content.slice(0, 10)}`}>
          <Text color={
            todo.status === 'completed' ? 'green' :
            todo.status === 'in_progress' ? 'yellow' :
            'gray'
          }>
            {todo.status === 'completed' ? '[x]' : todo.status === 'in_progress' ? '[>]' : '[ ]'}{' '}
          </Text>
          <Text color={todo.status === 'completed' ? 'gray' : 'white'}>
            {todo.status === 'in_progress' ? todo.activeForm : todo.content}
          </Text>
        </Box>
      ))}
    </Box>
  );
});
