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
  apiKey?: string | null;  // API key from keychain
  offlineMode?: boolean;   // Whether running in offline mode
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

export function App({ initialPrompt, model: initialModel, apiKey, offlineMode = false }: AppProps) {
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

  // Tool output navigation and expansion state
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Command palette state (to prevent arrow key conflicts)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Create agent with current model (only if we have API key)
  const agentRef = useRef<GrokAgent | null>(null);

  const getOrCreateAgent = useCallback(() => {
    // Only create agent if we have an API key (not in offline mode)
    if (offlineMode || !apiKey) {
      return null;
    }

    if (!agentRef.current || agentRef.current.model !== currentModel) {
      agentRef.current = new GrokAgent({
        model: currentModel,
        apiKey: apiKey  // Pass keychain API key
      });
    }
    return agentRef.current;
  }, [currentModel, offlineMode, apiKey]);

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
    offlineMode: offlineMode, // Set from parent (based on credential status)
  }), [currentModel, messages, exit]);

  // Handle command execution - returns { handled, submitPrompt? }
  const executeCommand = useCallback(async (input: string): Promise<{ handled: boolean; submitPrompt?: string }> => {
    const registry = getRegistry();
    const context = createCommandContext();
    const result = await registry.processInput(input, context);

    if (result.type === 'empty') {
      return { handled: true }; // Handled (do nothing)
    }

    if (result.type === 'message') {
      return { handled: false }; // Not a command, needs to be sent to agent
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
        case 'submit_prompt':
          // Return the prompt content to be submitted
          return { handled: true, submitPrompt: commandResult.action.content };
      }
    }

    return { handled: true }; // Command was handled
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

    // Guard against null agent (offline mode)
    if (!agent) {
      setError('AI is disabled (offline mode). Run \'grok auth login\' to enable AI features.');
      setState('idle');
      return;
    }

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
          case 'evidence':
            // Display evidence summary for verification
            if (event.evidence) {
              const summary = event.evidence.summary;
              setMessages(prev => [...prev, {
                id: generateId(),
                role: 'system',
                content: summary,
                timestamp: new Date(),
              }]);
            }
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
            // In offline mode, show helper message instead of running agent
            if (offlineMode) {
              setMessages([
                { id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() },
                {
                  id: generateId(),
                  role: 'system',
                  content: 'AI chat disabled (offline mode)\n\n' +
                           'Run \'grok auth login\' to enable AI features.',
                  timestamp: new Date(),
                },
              ]);
              setState('idle');
            } else {
              setMessages([{ id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() }]);
              runAgent(initialPrompt);
            }
          } else {
            setState('idle');
          }
        });
      } else {
        // In offline mode, show helper message instead of running agent
        if (offlineMode) {
          setMessages([
            { id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() },
            {
              id: generateId(),
              role: 'system',
              content: 'AI chat disabled (offline mode)\n\n' +
                       'Run \'grok auth login\' to enable AI features.',
              timestamp: new Date(),
            },
          ]);
          setState('idle');
        } else {
          setMessages([{ id: generateId(), role: 'user', content: initialPrompt, timestamp: new Date() }]);
          runAgent(initialPrompt);
        }
      }
    } else {
      // No initial prompt - just go to idle state
      setState('idle');
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
      const result = await executeCommand(value);

      // If command triggered a prompt submission (e.g., /prompt <file>)
      const promptContent = result.submitPrompt;
      if (promptContent) {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'user',
          content: promptContent,
          timestamp: new Date(),
        }]);
        runAgent(promptContent);
        return;
      }

      if (result.handled) {
        return; // Command was processed
      }
    }

    // In offline mode, non-command input shows helper message
    if (offlineMode && !value.startsWith('/')) {
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          role: 'user',
          content: value,
          timestamp: new Date(),
        },
        {
          id: generateId(),
          role: 'system',
          content: 'AI chat disabled (offline mode)\n\n' +
                   'Available commands:\n' +
                   '  /help        - Show all commands\n' +
                   '  /auth login  - Enable AI mode\n\n' +
                   'Available tools (use /help for details):\n' +
                   '  grep, read, write, edit, glob, bash, todo',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // It's a regular message - send to agent
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      content: value,
      timestamp: new Date(),
    }]);
    runAgent(value);
  }, [exit, executeCommand, runAgent, offlineMode]);

  // Handle confirmation response
  const handleConfirmResponse = useCallback((approved: boolean) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(approved);
      setPendingConfirm(null);
      setState('running');
    }
  }, [pendingConfirm]);

  // Toggle expansion for a tool output
  const toggleToolExpansion = useCallback((toolId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }

    // Tool output navigation:
    // - Enter navigation with ↑/↓ (does not interfere with typing)
    // - When a tool is selected: j/k or ↑/↓ to navigate, e to expand/collapse, Esc to return to input
    // - Do NOT activate if command palette is open (palette gets arrow priority)
    if (state === 'idle' && completedTools.length > 0 && !isCommandPaletteOpen) {
      const inputLower = input.toLowerCase();
      const isNavigatingTools = selectedToolIndex !== null;

      // Enter navigation mode with arrow keys
      if (!isNavigatingTools) {
        if (key.downArrow) {
          setSelectedToolIndex(0);
          return;
        }

        if (key.upArrow) {
          setSelectedToolIndex(completedTools.length - 1);
          return;
        }

        return;
      }

      // Navigate down: j or down arrow
      if (inputLower === 'j' || key.downArrow) {
        setSelectedToolIndex(prev => {
          if (prev === null) return 0;
          return Math.min(prev + 1, completedTools.length - 1);
        });
        return;
      }

      // Navigate up: k or up arrow
      if (inputLower === 'k' || key.upArrow) {
        setSelectedToolIndex(prev => {
          if (prev === null) return completedTools.length - 1;
          return Math.max(prev - 1, 0);
        });
        return;
      }

      // Expand/collapse: e
      if (inputLower === 'e' && selectedToolIndex !== null) {
        const tool = completedTools[selectedToolIndex];
        if (tool) {
          toggleToolExpansion(tool.id);
        }
        return;
      }

      // Return to input: Escape
      if (key.escape) {
        setSelectedToolIndex(null);
        return;
      }
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

  // Only messages go in Static (no interaction needed)
  // Tools are rendered dynamically to support selection/expansion
  const staticMessages = useMemo(() => {
    return completedMessages.map(msg => ({ id: msg.id, data: msg }));
  }, [completedMessages]);

  const todos = TodoTool.getTodos();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>grok-cli</Text>
        <Text color="gray"> - Claude Code for xAI Grok</Text>
        <Text color="gray"> [{currentModel}]</Text>
        {offlineMode && <Text color="yellow" bold> [OFFLINE]</Text>}
      </Box>

      {/* Offline Mode Banner */}
      {offlineMode && (
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
          marginBottom={1}
        >
          <Text color="yellow">
            OFFLINE MODE (No AI) - Run 'grok auth login' to enable AI features
          </Text>
        </Box>
      )}

      {/* Todo Display */}
      {todos.length > 0 && <TodoDisplay todos={todos} />}

      {/* Static: Completed messages (no interaction needed) */}
      <Static items={staticMessages}>
        {(item) => (
          <MessageDisplay key={item.id} role={item.data.role} content={item.data.content} />
        )}
      </Static>

      {/* Dynamic: Completed tool outputs (support selection/expansion) */}
      {completedTools.map((t, index) => (
        <ToolOutput
          key={t.id}
          toolName={t.tool}
          result={t.result}
          selected={selectedToolIndex === index}
          expanded={expandedTools.has(t.id)}
        />
      ))}

      {/* Dynamic: Pending tool outputs */}
      {pendingTools.map((t) => (
        <ToolOutput key={t.id} toolName={t.tool} result={t.result} />
      ))}

      {/* Navigation hint when tools exist */}
      {state === 'idle' && completedTools.length > 0 && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {selectedToolIndex === null
              ? '[↑/↓: select a tool output]'
              : '[j/k or ↑/↓: navigate | e: expand/collapse | Esc: return to input]'}
          </Text>
        </Box>
      )}

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
        <InputPrompt
          onSubmit={handleSubmit}
          isActive={selectedToolIndex === null}
          onPaletteVisibilityChange={setIsCommandPaletteOpen}
        />
      )}
    </Box>
  );
}
