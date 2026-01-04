# Bug Report: Text Disappearing After Command Input

**Date:** 2026-01-03
**Reporter:** Development Team
**Severity:** HIGH
**Status:** ACTIVE - Persists after 2 fix attempts

---

## Executive Summary

The grok-cli application experiences a critical UI bug where assistant messages appear briefly (~1 second) during streaming, then disappear from the terminal. This occurs consistently after sending any prompt to the AI agent.

**Root Cause:** Combination of React 18 state batching issues and Ink's Static component array management behavior.

**Most Likely Issue:** `setToolOutputs([])` reset on line 92 corrupts Ink's Static component internal index, combined with multiple Static components competing for a single static output buffer.

---

## Environment

| Component | Version/Info |
|-----------|--------------|
| **OS** | Linux pop-os 6.12.10-76061203-generic (x86_64) |
| **Node.js** | v22.21.1 |
| **npm** | 11.6.1 |
| **Ink** | 5.2.1 |
| **React** | 18.3.1 |
| **react-reconciler** | 0.29.2 |
| **TypeScript** | ^5.5.0 |
| **Terminal** | (User should specify: $TERM, $TERM_PROGRAM) |
| **TTY** | (User should verify: `node -e "console.log(process.stdin.isTTY)"`) |

---

## Reproduction Steps

### Prerequisites
```bash
cd /home/aip0rt/Desktop/grok-cli
export GROK_API_KEY="xai-your-key-here"  # Or XAI_API_KEY
npm install
npm run build
```

### Steps to Reproduce

1. **Launch the CLI:**
   ```bash
   npm run dev -- "Hello, how are you?"
   ```
   OR for interactive mode:
   ```bash
   npm run dev
   # Then type a prompt when prompted
   ```

2. **Observe streaming:**
   - Text appears in green as the agent streams the response
   - Progress is visible character-by-character (with 50ms batching)

3. **Bug manifests (~1 second after streaming completes):**
   - Streaming text disappears
   - Brief flicker or blank space appears
   - Message may or may not reappear in the completed messages section

4. **Expected vs Actual:**
   - **Expected:** Smooth transition from streaming text to Static completed message
   - **Actual:** Text disappears with visual flicker

---

## Visual Description

```
┌─ STREAMING PHASE ──────────────────────────────┐
│ grok-cli - Claude Code for xAI Grok            │
│                                                │
│ 👤 You                                         │
│   Hello, how are you?                          │
│                                                │
│ ⚡ Grok                                        │
│   [GREEN TEXT STREAMING: "Hello! I'm..."]      │  <- Visible during streaming
│                                                │
│ ⠋ Thinking...                                  │
└────────────────────────────────────────────────┘

         ↓ ~1 second passes

┌─ BUG: TEXT DISAPPEARS ─────────────────────────┐
│ grok-cli - Claude Code for xAI Grok            │
│                                                │
│ 👤 You                                         │
│   Hello, how are you?                          │
│                                                │
│ [BLANK - TEXT MISSING]                         │  <- Bug: text vanished
│                                                │
│ ❯ |                                            │  <- Input prompt appears
└────────────────────────────────────────────────┘

         ↓ May eventually appear

┌─ FINAL STATE (inconsistent) ───────────────────┐
│ grok-cli - Claude Code for xAI Grok            │
│                                                │
│ 👤 You                                         │
│   Hello, how are you?                          │
│                                                │
│ ⚡ Grok                                        │
│   Hello! I'm doing well, thank you!            │  <- Sometimes appears, sometimes not
│                                                │
│ ❯ |                                            │
└────────────────────────────────────────────────┘
```

---

## Code Context

### File: `src/ui/app.tsx` (Main UI Component)

**Critical Section 1: State Management (Lines 43-55)**
```typescript
const [state, setState] = useState<AppState>(initialPrompt ? 'running' : 'idle');
const [messages, setMessages] = useState<Message[]>([]);
const [streamingText, setStreamingText] = useState('');
const [toolOutputs, setToolOutputs] = useState<ToolOutputItem[]>([]);
const [error, setError] = useState<string | null>(null);
const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
const [agent] = useState(() => new GrokAgent({ model }));

// Anti-flickering: Buffer for streaming text
const textBufferRef = useRef('');
const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
const streamingTextRef = useRef('');  // Added in Fix #2
```

**Critical Section 2: Agent Event Loop (Lines 88-155)**
```typescript
const runAgent = useCallback(async (prompt: string) => {
  setState('running');
  setStreamingText('');
  streamingTextRef.current = '';  // Keep ref in sync
  setToolOutputs([]);  // ⚠️ HYPOTHESIS 1: This may break Static index
  setError(null);
  textBufferRef.current = '';

  try {
    for await (const event of agent.run(prompt, handleConfirmation)) {
      switch (event.type) {
        case 'text':
          appendText(event.content || '');
          break;
        // ... other cases
        case 'done':
          // Clear pending flush timer
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }

          // Capture ALL text: current ref + remaining buffer
          const fullText = streamingTextRef.current + textBufferRef.current;
          textBufferRef.current = '';
          streamingTextRef.current = '';

          // Clear streaming text
          setStreamingText('');

          // Add completed message to history (FIX #2: separate setState)
          if (fullText) {
            setMessages(prev => [...prev, {
              id: generateId(),
              role: 'assistant',
              content: fullText
            }]);
          }

          setState('idle');
          break;
      }
    }
  } catch (err) {
    flushBuffer();
    setError(err instanceof Error ? err.message : 'Agent failed');
    setState('idle');
  }
}, [agent, handleConfirmation, appendText, flushBuffer]);
```

**Critical Section 3: Rendering (Lines 224-235)**
```tsx
{/* ⚠️ HYPOTHESIS 2: Multiple Static components may conflict */}
<Static items={completedMessages}>
  {(msg) => (
    <MessageDisplay key={msg.id} role={msg.role} content={msg.content} />
  )}
</Static>

<Static items={completedTools}>
  {(t) => (
    <ToolOutput key={t.id} toolName={t.tool} result={t.result} />
  )}
</Static>
```

---

## Timeline of Fix Attempts

### Original Implementation (from PRP)
**Code:**
```typescript
case 'done':
  flushBuffer();
  setStreamingText(current => {
    if (current) {
      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: current }]);
    }
    return '';
  });
  setState('idle');
  break;
```

**Issue:** Nested `setMessages` inside `setStreamingText` updater (anti-pattern)
**Why it failed:** React batching causes inner setState to be skipped/deferred

---

### Fix Attempt #1: Clear Flush Timer
**Changed:** Added timer cleanup before `flushBuffer()`
**Code:**
```typescript
if (flushTimerRef.current) {
  clearTimeout(flushTimerRef.current);
  flushTimerRef.current = null;
}
flushBuffer();  // Still has nested setState below
```

**Hypothesis:** Timer race condition was causing text loss
**Result:** ❌ Failed - Text still disappears
**Learning:** Timer cleanup alone doesn't fix the nested setState anti-pattern

---

### Fix Attempt #2: Ref-Based Approach (Current)
**Changed:** Added `streamingTextRef` and separated setState calls
**Code:**
```typescript
const fullText = streamingTextRef.current + textBufferRef.current;
textBufferRef.current = '';
streamingTextRef.current = '';

setStreamingText('');  // Separate

if (fullText) {
  setMessages(prev => [...prev, {...}]);  // Separate - no nesting
}
```

**Hypothesis:** Refs provide synchronous access, avoiding state batching issues
**Result:** ❌ Failed - Text STILL disappears
**Learning:** The issue may not be state management, but Ink's rendering behavior

---

## Top 5 Root Cause Hypotheses

### 1. `setToolOutputs([])` Corrupts Static Index (MOST LIKELY) ⭐

**Location:** Line 92 in `app.tsx`

**The Issue:**
```typescript
setToolOutputs([]);  // Resets array to empty
```

When `runAgent` is called for a second command:
1. `completedTools` becomes `[]` (empty array)
2. Ink's Static component sees `items.length = 0`
3. Static's internal `index` state resets to `0`
4. **Previously rendered static content is orphaned**
5. Terminal may clear and re-render, losing the orphaned content

**Test:**
```typescript
// Replace line 92 with:
// setToolOutputs([]);  // REMOVE
```

**Expected Result:** Messages persist across multiple commands

---

### 2. Multiple Static Components Conflict (HIGH PROBABILITY) ⭐

**Location:** Lines 224-235 in `app.tsx`

**The Issue:**
Ink maintains a single `staticNode` in its reconciler. Having two `<Static>` components may cause:
- Competition for the static output buffer
- One Static overwriting the other
- Index state confusion

**Test:**
```tsx
// Merge into single Static:
const allStaticItems = useMemo(() => [
  ...completedMessages.map(m => ({ type: 'message' as const, ...m })),
  ...completedTools.map(t => ({ type: 'tool' as const, ...t })),
], [completedMessages, completedTools]);

<Static items={allStaticItems}>
  {(item) => item.type === 'message'
    ? <MessageDisplay {...item} />
    : <ToolOutput {...item} />
  }
</Static>
```

---

### 3. Terminal Height Overflow Triggers Full Clear (MEDIUM)

**Location:** Ink's internal `renderer.js`

**The Issue:**
When output height >= terminal rows, Ink sends `clearTerminal` ANSI code and re-renders. If the `fullStaticOutput` wasn't properly accumulated (due to index reset), content is lost.

**Test:**
```bash
# Run in very tall terminal
stty rows 200
npm run dev -- "Test"
```

---

### 4. React 18 Automatic Batching Timing (MEDIUM)

**Location:** Lines 133-144 in `app.tsx`

**The Issue:**
```typescript
setStreamingText('');  // Update 1
setMessages(prev => [...prev, {...}]);  // Update 2
setState('idle');  // Update 3
```

Three separate setState calls may not batch atomically, causing a render where:
- Streaming text is cleared
- Messages not yet updated
- = Blank screen moment

**Test:**
```typescript
// Use React's flushSync for atomic updates
import { flushSync } from 'react-dom';
flushSync(() => {
  setStreamingText('');
  setMessages(prev => [...prev, {...}]);
  setState('idle');
});
```

---

### 5. `useEffect` Cleanup Timing (LOW)

**Location:** Lines 158-166 in `app.tsx`

**The Issue:**
Empty dependency array with timer cleanup. If React strict mode re-renders or hot reload occurs, cleanup could fire mid-operation.

**Test:**
```bash
# Disable strict mode in index.tsx
# <StrictMode> is not being used, so this is less likely
```

---

## Recommended Fix (Multi-Part)

### Part 1: Don't Reset toolOutputs
```typescript
// Line 92 - Comment out or remove:
// setToolOutputs([]);  // REMOVE THIS LINE
```

### Part 2: Consolidate Static Components
```typescript
// Lines 224-244 - Replace two Static components with one:
const allCompletedItems = useMemo(() => {
  const items: Array<{ type: 'message' | 'tool'; data: any; id: string }> = [];

  completedMessages.forEach(msg => {
    items.push({ type: 'message', data: msg, id: msg.id });
  });

  completedTools.forEach(tool => {
    items.push({ type: 'tool', data: tool, id: tool.id });
  });

  return items;
}, [completedMessages, completedTools]);

<Static items={allCompletedItems}>
  {(item) => item.type === 'message'
    ? <MessageDisplay key={item.id} role={item.data.role} content={item.data.content} />
    : <ToolOutput key={item.id} toolName={item.data.tool} result={item.data.result} />
  }
</Static>
```

### Part 3: Use flushSync for Atomic Updates (if needed)
```typescript
import { flushSync } from 'react-dom';

case 'done':
  if (flushTimerRef.current) {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }

  const fullText = streamingTextRef.current + textBufferRef.current;
  textBufferRef.current = '';
  streamingTextRef.current = '';

  // Atomic update - all state changes happen together
  flushSync(() => {
    setStreamingText('');
    if (fullText) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: fullText
      }]);
    }
    setState('idle');
  });
  break;
```

---

## Debugging Instrumentation

Add this code to `src/ui/app.tsx` for diagnosis:

```typescript
// After line 55, add debugging:
useEffect(() => {
  console.error(`[DEBUG] Messages: ${messages.length}`, messages.map(m => ({ id: m.id, role: m.role, len: m.content.length })));
}, [messages]);

useEffect(() => {
  console.error(`[DEBUG] StreamingText: ${streamingText.length} chars`);
}, [streamingText]);

useEffect(() => {
  console.error(`[DEBUG] CompletedMessages: ${completedMessages.length}`);
}, [completedMessages]);

useEffect(() => {
  console.error(`[DEBUG] ToolOutputs: ${toolOutputs.length}, Completed: ${completedTools.length}`);
}, [toolOutputs, completedTools]);

// In the done handler, add:
case 'done':
  console.error('[DEBUG] DONE EVENT RECEIVED');
  console.error('[DEBUG] streamingTextRef.current:', streamingTextRef.current.length);
  console.error('[DEBUG] textBufferRef.current:', textBufferRef.current.length);

  if (flushTimerRef.current) {
    console.error('[DEBUG] Clearing flush timer');
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }

  const fullText = streamingTextRef.current + textBufferRef.current;
  console.error('[DEBUG] fullText length:', fullText.length);

  // ... rest of handler
```

---

## File Inventory

### Core Files
| File | Lines | Purpose |
|------|-------|---------|
| `src/ui/app.tsx` | 257 | Main UI component (BUG LOCATION) |
| `src/agent/grok-agent.ts` | 198 | Agent loop and event emission |
| `src/ui/components/message.tsx` | 24 | Message display component |
| `src/ui/components/tool-output.tsx` | 33 | Tool output display |
| `src/ui/components/input.tsx` | 32 | Input prompt |
| `src/ui/components/spinner.tsx` | 26 | Loading indicator |

### Dependencies
| Package | Version | Relevance |
|---------|---------|-----------|
| `ink` | 5.2.1 | UI framework - Static component source |
| `react` | 18.3.1 | State management - batching behavior |
| `react-reconciler` | 0.29.2 | Rendering engine used by Ink |

---

## Critical Code Sections

### The `done` Event Handler (Lines 120-145)

```typescript:src/ui/app.tsx
case 'done':
  // Clear pending flush timer to prevent race condition
  if (flushTimerRef.current) {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }

  // Capture ALL text: current ref + remaining buffer
  const fullText = streamingTextRef.current + textBufferRef.current;
  textBufferRef.current = '';
  streamingTextRef.current = '';

  // Clear streaming text
  setStreamingText('');

  // Add completed message to history (separate setState - no nesting!)
  if (fullText) {
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'assistant',
      content: fullText
    }]);
  }

  setState('idle');
  break;
```

**Potential Issues:**
1. Three separate setState calls may not batch atomically
2. Gap between `setStreamingText('')` and message appearing in Static
3. If `fullText` is empty, no message is added (verify text is captured)

---

### Static Component Usage (Lines 224-235)

```typescript:src/ui/app.tsx
{/* Static: Completed messages - these NEVER cause re-renders */}
<Static items={completedMessages}>
  {(msg) => (
    <MessageDisplay key={msg.id} role={msg.role} content={msg.content} />
  )}
</Static>

{/* Static: Completed tool outputs */}
<Static items={completedTools}>
  {(t) => (
    <ToolOutput key={t.id} toolName={t.tool} result={t.result} />
  )}
</Static>
```

**Potential Issues:**
1. Two Static components may conflict (Ink has one static buffer)
2. `completedMessages` filter may have issues (line 195-198)
3. Array reference changes could confuse Static's index tracking

---

### Message Filter (Lines 195-198)

```typescript:src/ui/app.tsx
const completedMessages = useMemo(() =>
  messages.filter(m => m.role !== 'streaming'),
  [messages]
);
```

**Note:** The filter `m.role !== 'streaming'` is checking for a role that never exists in the code. Messages only have `role: 'user'` or `role: 'assistant'`. This appears to be dead code but is benign (filter always passes).

---

## Ink's Static Component Internals

From `node_modules/ink/build/components/Static.js`:

```javascript
export default function Static(props) {
    const { items, children: render } = props;
    const [index, setIndex] = useState(0);

    const itemsToRender = useMemo(() => {
        return items.slice(index);  // Only renders NEW items
    }, [items, index]);

    useLayoutEffect(() => {
        setIndex(items.length);  // Updates index to skip already-rendered items
    }, [items.length]);

    const children = itemsToRender.map((item, itemIndex) => {
        return render(item, index + itemIndex);
    });
    // ...
}
```

**How Static Breaks:**
1. First render: `items = [msg1, msg2]`, `index = 0` → renders both → sets `index = 2`
2. Array reset: `items = []` → `index` is still 2 → `items.slice(2) = []` → nothing renders
3. New items: `items = [msg3]` → `index = 2` → `items.slice(2) = []` → **msg3 never renders!**

---

## Attempted Fixes Summary

| Attempt | Change | Result | Root Cause Addressed? |
|---------|--------|--------|----------------------|
| #1 | Clear flush timer, keep nested setState | ❌ Failed | No - nested setState still problematic |
| #2 | Ref-based approach, separate setState | ❌ Failed | Partially - but doesn't fix Static reset issue |

---

## Recommended Solution

### Primary Fix: Prevent Array Resets

**File:** `src/ui/app.tsx`

**Change 1 - Don't reset toolOutputs (line 92):**
```typescript
// BEFORE:
setToolOutputs([]);

// AFTER:
// Don't reset - let tools accumulate as history
// OR add a session separator instead
```

**Change 2 - Consolidate Static components (lines 224-244):**
```typescript
// Create unified static items array
const allCompletedItems = useMemo(() => [
  ...completedMessages.map(m => ({ type: 'msg' as const, id: m.id, data: m })),
  ...completedTools.map(t => ({ type: 'tool' as const, id: t.id, data: t })),
], [completedMessages, completedTools]);

// Single Static component
<Static items={allCompletedItems}>
  {(item) => item.type === 'msg'
    ? <MessageDisplay key={item.id} {...item.data} />
    : <ToolOutput key={item.id} {...item.data} />
  }
</Static>
```

**Change 3 - Use flushSync for atomic state updates (lines 133-144):**
```typescript
import { flushSync } from 'react-dom';

// In done handler:
flushSync(() => {
  setStreamingText('');
  if (fullText) {
    setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: fullText }]);
  }
  setState('idle');
});
```

---

## Alternative Workarounds

### Workaround 1: Never Use Static for Messages
```tsx
{/* Render messages directly without Static */}
{messages.map((msg) => (
  <MessageDisplay key={msg.id} role={msg.role} content={msg.content} />
))}
```

**Trade-off:** May cause flickering (defeats anti-flicker purpose)

---

### Workaround 2: Manual Terminal Output
```typescript
const { write } = useStdout();

useEffect(() => {
  const newMessages = messages.slice(renderedCountRef.current);
  newMessages.forEach(msg => {
    write(`[${msg.role}] ${msg.content}\n`);
  });
  renderedCountRef.current = messages.length;
}, [messages]);
```

**Trade-off:** Bypasses Ink's React abstraction

---

### Workaround 3: Use Ink Debug Mode
```typescript
// In src/index.tsx:
render(<App initialPrompt={prompt} model={model} />, {
  debug: true  // Disables 32ms throttling
});
```

---

## Testing Checklist

After applying fixes, verify:

- [ ] Run `npm run build`
- [ ] Test: `grok "Hello"` - message persists
- [ ] Test: Multiple commands in sequence - all messages visible
- [ ] Test: Long responses (>100 lines) - no disappearing
- [ ] Test: Terminal resize during streaming - content preserved
- [ ] Check debug logs for state values
- [ ] Verify `completedMessages.length` increases with each command

---

## Additional Context

### Security Fixes Applied
This codebase has had recent security hardening:
- Command injection prevention (4-layer defense)
- Path traversal via symlink protection
- All tools updated to async validation

These changes don't affect the UI bug but are mentioned for completeness.

### Project Status
- Phase 1: ✅ Complete (28 files, working CLI)
- Security: ✅ Hardened (CRITICAL + HIGH vulnerabilities fixed)
- UI Bug: ⚠️ ACTIVE (text disappearing issue)
- Global Install: ✅ `npm link` successful, `grok` command available

---

## Contact

For questions about this bug report, refer to:
- `/home/aip0rt/Desktop/grok-cli/docs/prp-claude-build-grok-cli.md` (original spec)
- `/home/aip0rt/Desktop/grok-cli/docs/EXECUTION-PROMPT.md` (execution guide)

---

**Report Generated:** 2026-01-03
**Generated By:** ULTRATHINK investigation with 4 parallel Opus agents
