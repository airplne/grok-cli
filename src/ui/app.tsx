import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Box, Text, useApp, useInput, Static } from 'ink';
import { GrokAgent, AgentEvent } from '../agent/grok-agent.js';
import { MessageDisplay } from './components/message.js';
import { ToolOutput } from './components/tool-output.js';
import { InputPrompt } from './components/input.js';
import { Spinner } from './components/spinner.js';
import { ConfirmDialog } from './components/confirm.js';
import { TodoDisplay } from './components/todo-display.js';
import { TodoTool } from '../tools/todo.js';
import { getRegistry, isCommand, CommandContext, HistoryMessage, CommandResult } from '../commands/index.js';
import { getDefaultModel, resolveModelId } from '../config/models.js';

interface AppProps {
  initialPrompt?: string;
  model?: string;
}

type AppState = 'idle' | 'running' | 'waiting_input' | 'confirming';

interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: Date;
  model?: string;
}

interface ToolOutputItem {
  id: string;
  tool: string;
  result: unknown;
  completed: boolean;
}

interface PendingConfirmation {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

// Generate stable IDs
let messageIdCounter = 0;
const generateId = () => `msg-${++messageIdCounter}`;

export function App({ initialPrompt, model: initialModel }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(initialPrompt ? 'running' : 'idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [toolOutputs, setToolOutputs] = useState<ToolOutputItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [currentModel, setCurrentModel] = useState(() =>
    initialModel ? resolveModelId(initialModel) : getDefaultModel()
  );
  const [commandOutput, setCommandOutput] = useState<string | null>(null);

  // Create agent with current model
  const agentRef = useRef<GrokAgent | null>(null);

  const getOrCreateAgent = useCallback(() => {
    if (!agentRef.current || agentRef.current.model !== currentModel) {
      agentRef.current = new GrokAgent({ model: currentModel });
    }
    return agentRef.current;
  }, [currentModel]);

  // Anti-flickering: Buffer for streaming text
  const textBufferRef = useRef('');
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingTextRef = useRef('');

  // Flush buffered text to state (batched updates prevent flickering)
  const flushBuffer = useCallback(() => {
    if (textBufferRef.current) {
      setStreamingText(prev => {
        const updated = prev + textBufferRef.current;
        streamingTextRef.current = updated;
        return updated;
      });
      textBufferRef.current = '';
    }
    flushTimerRef.current = null;
  }, []);

  // Add text to buffer with debounced flush (50ms batching)
  const appendText = useCallback((text: string) => {
    textBufferRef.current += text;
    streamingTextRef.current += text;
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushBuffer, 50);
    }
  }, [flushBuffer]);

  // Handle confirmation dialog
  const handleConfirmation = useCallback((toolName: string, args: Record<string, unknown>): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingConfirm({ toolName, args, resolve });
      setState('confirming');
    });
  }, []);

  // Create command context
  const createCommandContext = useCallback((): CommandContext => ({
    currentModel,
    setModel: (model: string) => {
      setCurrentModel(model);
      agentRef.current = null; // Force agent recreation with new model
    },
    getHistory: (): HistoryMessage[] => {
      return messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.timestamp,
        model: m.model,
      }));
    },
    clearHistory: () => {
      setMessages([]);
      setToolOutputs([]);
      setError(null);
      setCommandOutput(null);
    },
    exit: () => exit(),
    cwd: process.cwd(),
  }), [currentModel, messages, exit]);

  // Handle command execution
  const executeCommand = useCallback(async (input: string): Promise<boolean> => {
    const registry = getRegistry();
    const context = createCommandContext();
    const result = await registry.processInput(input, context);

    if (result.type === 'empty') {
      return true; // Handled (do nothing)
    }

    if (result.type === 'message') {
      return false; // Not a command, needs to be sent to agent
    }

    // It's a command result
    const commandResult = result.result;

    if (commandResult.output) {
      setCommandOutput(commandResult.output);
    }

    if (commandResult.error) {
      setError(commandResult.error);
    }

    // Handle special actions
    if (commandResult.action) {
      switch (commandResult.action.type) {
        case 'exit':
          setTimeout(() => exit(), 100);
          break;
        case 'clear':
          setMessages([]);
          setToolOutputs([]);
          setCommandOutput(null);
          break;
        case 'set_model':
          // Model already set via context.setModel
          break;
      }
    }

    return true; // Command was handled
  }, [createCommandContext, exit]);

  // Process agent events
  const runAgent = useCallback(async (prompt: string) => {
    setState('running');
    setStreamingText('');
    streamingTextRef.current = '';
    setError(null);
    setCommandOutput(null);
    textBufferRef.current = '';

    const agent = getOrCreateAgent();

    try {
      for await (const event of agent.run(prompt, handleConfirmation)) {
        switch (event.type) {
          case 'text':
            appendText(event.content || '');
            break;
          case 'tool_start':
            const toolId = generateId();
            setToolOutputs(prev => [...prev, {
              id: toolId,
              tool: event.tool!,
              result: 'running...',
              completed: false
            }]);
            break;
          case 'tool_result':
            setToolOutputs(prev => prev.map(t =>
              t.tool === event.tool && !t.completed
                ? { ...t, result: event.result, completed: true }
                : t
            ));
            break;
          case 'error':
            setError(event.error || 'Unknown error');
            break;
          case 'done':
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }

            const fullText = streamingTextRef.current + textBufferRef.current;
            textBufferRef.current = '';
            streamingTextRef.current = '';

            flushSync(() => {
              setStreamingText('');

              if (fullText) {
                setMessages(prev => [...prev, {
                  id: generateId(),
                  role: 'assistant',
                  content: fullText,
                  timestamp: new Date(),
                  model: currentModel,
                }]);
              }

              setState('idle');
            });
            break;
        }
      }
    } catch (err) {
      flushBuffer();
      setError(err instanceof Error ? err.message : 'Agent failed');
      setState('idle');
    }
  }, [getOrCreateAgent, handleConfirmation, appendText, flushBuffer, currentModel]);

  // Run initial prompt
  useEffect(() => {
    if (initialPrompt) {
      // Check if initial prompt is a command
      if (isCommand(initialPrompt)) {
        executeCommand(initialPrompt).then((handled) => {
          if (!handled) {
            setMessages([{ id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() }]);
            runAgent(initialPrompt);
          } else {
            setState('idle');
          }
        });
      } else {
        setMessages([{ id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() }]);
        runAgent(initialPrompt);
      }
    }
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  // Handle user input
  const handleSubmit = useCallback(async (value: string) => {
    // Clear previous command output
    setCommandOutput(null);
    setError(null);

    // Check for legacy exit commands (without slash)
    if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
      exit();
      return;
    }

    // Check if it's a command
    if (isCommand(value)) {
      const handled = await executeCommand(value);
      if (handled) {
        return; // Command was processed
      }
    }

    // It's a regular message - send to agent
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      content: value,
      timestamp: new Date(),
    }]);
    runAgent(value);
  }, [exit, executeCommand, runAgent]);

  // Handle confirmation response
  const handleConfirmResponse = useCallback((approved: boolean) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(approved);
      setPendingConfirm(null);
      setState('running');
    }
  }, [pendingConfirm]);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  // Memoized completed content
  const completedMessages = useMemo(() =>
    messages.filter(m => m.role !== 'streaming'),
    [messages]
  );

  const completedTools = useMemo(() =>
    toolOutputs.filter(t => t.completed),
    [toolOutputs]
  );

  const pendingTools = useMemo(() =>
    toolOutputs.filter(t => !t.completed),
    [toolOutputs]
  );

  const allCompletedItems = useMemo(() => {
    const items: Array<{ type: 'message' | 'tool'; id: string; data: any }> = [];

    completedMessages.forEach(msg => {
      items.push({ type: 'message', id: msg.id, data: msg });
    });

    completedTools.forEach(tool => {
      items.push({ type: 'tool', id: tool.id, data: tool });
    });

    return items;
  }, [completedMessages, completedTools]);

  const todos = TodoTool.getTodos();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>grok-cli</Text>
        <Text color="gray"> - Claude Code for xAI Grok</Text>
        <Text color="gray"> [{currentModel}]</Text>
      </Box>

      {/* Todo Display */}
      {todos.length > 0 && <TodoDisplay todos={todos} />}

      {/* Consolidated Static: All completed items */}
      <Static items={allCompletedItems}>
        {(item) => item.type === 'message' ? (
          <MessageDisplay key={item.id} role={item.data.role} content={item.data.content} />
        ) : (
          <ToolOutput key={item.id} toolName={item.data.tool} result={item.data.result} />
        )}
      </Static>

      {/* Dynamic: Pending tool outputs */}
      {pendingTools.map((t) => (
        <ToolOutput key={t.id} toolName={t.tool} result={t.result} />
      ))}

      {/* Streaming text */}
      {streamingText && (
        <Box marginY={1}>
          <Text color="green">{streamingText}</Text>
        </Box>
      )}

      {/* Command output */}
      {commandOutput && (
        <Box marginY={1} flexDirection="column">
          <Text color="cyan">{commandOutput}</Text>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box marginY={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Confirmation dialog */}
      {state === 'confirming' && pendingConfirm && (
        <ConfirmDialog
          toolName={pendingConfirm.toolName}
          args={pendingConfirm.args}
          onResponse={handleConfirmResponse}
        />
      )}

      {/* Loading spinner */}
      {state === 'running' && !pendingConfirm && <Spinner text="Thinking..." />}

      {/* Input prompt */}
      {state === 'idle' && (
        <InputPrompt onSubmit={handleSubmit} />
      )}
    </Box>
  );
}
