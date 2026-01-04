# Debugging Instrumentation for Text Disappearing Bug

This file contains code snippets to add to `src/ui/app.tsx` for debugging the text disappearing issue.

---

## Option 1: Console Logging (Quick Diagnosis)

Add these `useEffect` hooks after line 55 in `src/ui/app.tsx`:

```typescript
// Debug: Log messages state changes
useEffect(() => {
  console.error('[DEBUG] messages changed:', {
    count: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      preview: m.content.slice(0, 50) + (m.content.length > 50 ? '...' : '')
    }))
  });
}, [messages]);

// Debug: Log streamingText changes
useEffect(() => {
  console.error('[DEBUG] streamingText changed:', {
    length: streamingText.length,
    preview: streamingText.slice(0, 100)
  });
}, [streamingText]);

// Debug: Log completedMessages changes
useEffect(() => {
  console.error('[DEBUG] completedMessages:', {
    count: completedMessages.length,
    ids: completedMessages.map(m => m.id)
  });
}, [completedMessages]);

// Debug: Log tool outputs
useEffect(() => {
  console.error('[DEBUG] toolOutputs:', {
    total: toolOutputs.length,
    completed: completedTools.length,
    pending: pendingTools.length
  });
}, [toolOutputs, completedTools, pendingTools]);

// Debug: Log state changes
useEffect(() => {
  console.error('[DEBUG] App state changed:', state);
}, [state]);
```

---

## Option 2: Enhanced Done Handler Logging

Replace the `done` case (lines 120-145) with this instrumented version:

```typescript
case 'done':
  console.error('\n=== DONE EVENT START ===');
  console.error('[DEBUG] streamingTextRef.current length:', streamingTextRef.current.length);
  console.error('[DEBUG] textBufferRef.current length:', textBufferRef.current.length);
  console.error('[DEBUG] streamingText state length:', streamingText.length);

  // Clear pending flush timer to prevent race condition
  if (flushTimerRef.current) {
    console.error('[DEBUG] Clearing flush timer');
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  } else {
    console.error('[DEBUG] No flush timer to clear');
  }

  // Capture ALL text: current ref + remaining buffer
  const fullText = streamingTextRef.current + textBufferRef.current;
  console.error('[DEBUG] fullText combined length:', fullText.length);
  console.error('[DEBUG] fullText preview:', fullText.slice(0, 100));

  textBufferRef.current = '';
  streamingTextRef.current = '';

  // Clear streaming text
  console.error('[DEBUG] Calling setStreamingText(\\'\\')');
  setStreamingText('');

  // Add completed message to history
  if (fullText) {
    console.error('[DEBUG] Calling setMessages with fullText');
    setMessages(prev => {
      console.error('[DEBUG] Inside setMessages, prev length:', prev.length);
      const newMessages = [...prev, {
        id: generateId(),
        role: 'assistant',
        content: fullText
      }];
      console.error('[DEBUG] New messages length:', newMessages.length);
      return newMessages;
    });
  } else {
    console.error('[DEBUG] WARNING: fullText is empty! No message added.');
  }

  console.error('[DEBUG] Calling setState(idle)');
  setState('idle');
  console.error('=== DONE EVENT END ===\n');
  break;
```

---

## Option 3: Ref-Based Message Persistence

Add this after the state declarations (around line 55):

```typescript
// Track if messages are being lost
const messagesRef = useRef<Message[]>([]);

// Keep ref in sync with messages state
useEffect(() => {
  messagesRef.current = messages;
  console.error('[DEBUG] messagesRef updated, length:', messagesRef.current.length);
}, [messages]);

// Verify messages persist after renders
useEffect(() => {
  if (state === 'idle' && messagesRef.current.length > 0) {
    console.error('[DEBUG] Idle state - messages in ref:', messagesRef.current.length);
    console.error('[DEBUG] Idle state - messages in state:', messages.length);
    if (messagesRef.current.length !== messages.length) {
      console.error('[DEBUG] ⚠️ MISMATCH: Ref and state have different lengths!');
    }
  }
}, [state, messages]);
```

---

## Option 4: Static Component Health Check

Add this to verify Static is rendering correctly:

```typescript
// After completedMessages memo (around line 198):
useEffect(() => {
  console.error('[DEBUG] Static items check:', {
    completedMessages: completedMessages.length,
    completedTools: completedTools.length,
    totalStaticItems: completedMessages.length + completedTools.length
  });

  // Verify Static items have stable IDs
  const messageIds = completedMessages.map(m => m.id);
  const hasDuplicateIds = new Set(messageIds).size !== messageIds.length;
  if (hasDuplicateIds) {
    console.error('[DEBUG] ⚠️ DUPLICATE MESSAGE IDs DETECTED!');
  }
}, [completedMessages, completedTools]);
```

---

## Quick Test Script

Create `test-ui-bug.sh`:

```bash
#!/bin/bash

echo "Testing grok-cli text disappearing bug"
echo "======================================"
echo ""

export GROK_API_KEY="test-key"
export DEBUG=1

echo "Test 1: Single prompt"
echo "----------------------"
npm run dev -- "Say hello in 5 words" 2>&1 | tee test-output-1.log

echo ""
echo "Test 2: Multiple prompts (if interactive works)"
echo "------------------------------------------------"
echo "Type 'hello' then ENTER, observe if text persists"
echo "Type 'exit' to quit"
npm run dev 2>&1 | tee test-output-2.log

echo ""
echo "Logs saved to test-output-1.log and test-output-2.log"
echo "Review for [DEBUG] markers"
```

Run with:
```bash
chmod +x test-ui-bug.sh
./test-ui-bug.sh
```

---

## Expected Debug Output

If the bug is the Static index issue, you'll see:

```
[DEBUG] DONE EVENT START
[DEBUG] fullText combined length: 45
[DEBUG] Calling setMessages with fullText
[DEBUG] Inside setMessages, prev length: 1
[DEBUG] New messages length: 2
[DEBUG] messages changed: { count: 2, messages: [...] }
[DEBUG] completedMessages: { count: 2, ids: ['msg-1', 'msg-2'] }
[DEBUG] Static items check: { completedMessages: 2, completedTools: 0, totalStaticItems: 2 }
```

But if messages is 2 but Static still doesn't show content, the issue is in Ink's rendering, not state management.

---

## Comparing to Working Claude Code Implementation

If possible, compare with actual Claude Code's Ink implementation to see how they handle the same problem. Claude Code likely:
1. Uses a single Static component
2. Never resets arrays
3. May use a different Ink version or custom patches

---

## Next Steps

1. Add Option 1 logging to `src/ui/app.tsx`
2. Run `npm run build`
3. Test with `grok "Hello"`
4. Review debug output in stderr
5. Determine if messages state is being updated correctly
6. If messages IS updating but Static doesn't render, the issue is Ink-specific
7. If messages is NOT updating, there's still a state management bug
