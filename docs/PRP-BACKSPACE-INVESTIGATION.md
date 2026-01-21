# PRP: Backspace/Delete Key Input Failure Investigation

**Repo**: `airplne/grok-cli`
**Branch**: `feature/command-palette` (PR #11)
**Severity**: CRITICAL - Input editing completely broken
**Environment**: Pop!_OS 22.04 GNOME Terminal + tmux
**Latest Commit**: `ee90236`

---

## Problem Statement

**Backspace and Delete keys do nothing** in the main chat input prompt.

**Observable Behavior**:
- User types text (works)
- User presses Backspace → cursor doesn't move, text doesn't delete
- User presses Delete → no effect
- Cursor appears frozen at end of input

**Impact**: Makes the CLI unusable for editing prompts. Users cannot correct typos or edit text.

---

## Environment

- **OS**: Pop!_OS 22.04 LTS (Ubuntu-based)
- **Terminal**: GNOME Terminal 3.44.0
- **Shell**: Bash (also tested in tmux)
- **Node**: v22.21.1
- **grok-cli**: v2.0.4
- **Installed via**: `npm install -g` (symlinked to repo: `/home/aip0rt/Desktop/grok-cli`)

**Terminal Settings**:
- Backspace key behavior: Unknown (need to verify with `cat -v` test)
- Possibly sends: `^?` (DEL/\x7f) or `^H` (BS/\x08)

---

## Reproduction Steps

1. Run: `grok`
2. Type: `hello world`
3. Press: Backspace
4. Observe: Text doesn't delete, cursor doesn't move

**Consistent across**:
- GNOME Terminal (native)
- tmux session
- Both typing and pasted input

---

## Attempted Fixes (Chronological)

### Fix #1: Byte Code Detection (`9d44946`)
**Theory**: Ink's `key.backspace` flag not set on Pop!_OS.
**Implementation**: Added byte code fallbacks:
```typescript
const isBackspace =
  key.backspace ||
  input === '\x7f' ||  // DEL
  input === '\b' ||    // BS
  input === '\x08';    // Control-H
```
**Result**: Still broken ❌

### Fix #2: Remove Unconditional Return (`724ddc8`)
**Theory**: App-level handler blocking input.
**Implementation**: Removed `return;` on line 486 in tool navigation handler.
**Result**: Still broken ❌

### Fix #3: InputPrompt Always Active (`ee90236`)
**Theory**: `isActive={selectedToolIndex === null}` disables input.
**Implementation**: Changed to `isActive={true}`.
**Result**: Still broken ❌

---

## Current State Analysis

### Code Architecture

**Input Flow**:
```
User presses key
  ↓
Ink useInput hook fires
  ↓
InputPrompt useInput handler (src/ui/components/input.tsx:103)
  ↓
Checks: isBackspace / isDelete / isArrow / isText
  ↓
Calls: setEditorState(prev => deleteBackward(prev))
  ↓
React state update triggers re-render
  ↓
Display updates
```

**Current Handler** (`src/ui/components/input.tsx:232-244`):
```typescript
const isBackspace =
  key.backspace ||
  input === '\x7f' ||
  input === '\b' ||
  input === '\x08';

if (isBackspace) {
  setEditorState(prev => deleteBackward(prev));
  setPaletteDismissed(false);
  if (debugMode) setLastKeyEvent(...);
  return;
}
```

### Potential Root Causes (Ranked by Likelihood)

**1. useInput Hook Not Firing** (HIGH)
- Ink's `useInput` requires `isActive` option
- Current: `}, { isActive });` where `isActive` prop should be `true`
- **Issue**: If there's ANOTHER useInput handler in the component tree consuming the event, it won't reach InputPrompt
- **Check**: App.tsx has its own useInput (line 461) - might be consuming events first

**2. Wrong Byte Sequence** (MEDIUM)
- Pop!_OS might send non-standard Backspace sequence
- Need actual debug output to confirm
- **Check**: Debug overlay should show `input="..."` and `flags=[...]`

**3. State Update Not Triggering Render** (LOW)
- `setEditorState` called but React doesn't re-render
- Unlikely but possible with `useMemo` dependencies
- **Check**: Debug should show state change in real-time

**4. Event Consumed by Parent** (HIGH)
- App.tsx useInput (line 461) runs BEFORE InputPrompt useInput
- If it doesn't return early, BOTH handlers fire (correct)
- If it returns early without checking key type, input blocked
- **Check**: App.tsx handler must ONLY handle tool navigation keys (j/k/↑/↓/e/Esc), not Backspace

---

## Architectural Context

### Multiple useInput Handlers (CRITICAL)

**Handler #1**: `src/ui/app.tsx:461` (App-level, ALWAYS ACTIVE)
```typescript
useInput((input, key) => {
  if (key.ctrl && input === 'c') { exit(); }

  // Tool navigation (when idle + tools exist + !palette)
  if (state === 'idle' && completedTools.length > 0 && !isCommandPaletteOpen) {
    // Handles: j/k/↑/↓/e/Esc
    // MUST NOT handle: Backspace, Delete, letters, arrows when not navigating
  }
});
```

**Handler #2**: `src/ui/components/input.tsx:103` (InputPrompt, conditional)
```typescript
useInput((input, key) => {
  // Handles: Backspace, Delete, arrows, typing, palette nav
}, { isActive }); // ← Now should be true
```

**Problem**: If App handler doesn't return early for non-navigation keys, both handlers fire. If both call setState, which one wins?

### State Management

**Editor State**:
```typescript
const [editorState, setEditorState] = useState<EditorState>({
  value: '',
  cursorIndex: 0
});
```

**Updates via**:
- `deleteBackward(state)` → returns new state with char removed
- React should re-render when state object reference changes

---

## Proposed Solutions

### Solution A: Verify Handler Ordering (IMMEDIATE)

**Diagnostic Steps**:
1. Run `grok`
2. Press Ctrl+D (enable debug)
3. Type `a`
4. Press Backspace
5. Paste debug output showing:
   - Key event details
   - Action taken
   - State before/after

**If debug shows "BACKSPACE" action but state doesn't change**:
→ State update bug (immutability issue or React not re-rendering)

**If debug shows nothing**:
→ useInput not firing (check `isActive` or handler ordering)

### Solution B: Isolate InputPrompt (TEST)

**Create minimal test**:
```typescript
// Temporarily comment out App-level useInput handler (line 461)
// Test if Backspace works in InputPrompt alone
```

**If this fixes it**:
→ App handler is interfering (consuming events or wrong return logic)

### Solution C: Check React State Updates

**Verify deleteBackward returns new object**:
```typescript
// src/ui/utils/input-editor.ts:53
export function deleteBackward(state: EditorState): EditorState {
  if (cursorIndex === 0) return state; // Same object!
  return { value: before + after, cursorIndex: cursorIndex - 1 }; // New object
}
```

**Issue**: If cursor at 0, returns SAME object → React won't re-render.
**But**: This shouldn't affect middle/end deletions.

### Solution D: Raw stdin Interference

**Check bracketed paste listener**:
```typescript
// src/ui/components/input.tsx:77-100
stdin.on('data', handleData) // Might be consuming Backspace bytes?
```

**If stdin listener sees `\x7f` before useInput**:
→ It processes as paste data, never reaches useInput

---

## Verification Protocol

### Phase 1: Capture Evidence (REQUIRED)

**User must run these commands and paste output**:

```bash
# 1. What does your Backspace send?
cat -v
# Press Backspace, then Ctrl+C
# Should show: ^? (DEL) or ^H (BS)

# 2. Verify build is current
ls -la dist/ui/components/input.js | head -1
git rev-parse HEAD

# 3. Run grok with debug
grok
# Press Ctrl+D (enables debug)
# Type: abc
# Press: Backspace
# PASTE the magenta debug box output
```

### Phase 2: Code Inspection

**Check these potential blockers**:

1. **App-level useInput consumes event** (`src/ui/app.tsx:461-520`):
   ```bash
   # Search for any path that doesn't return early
   rg -A5 "if \(state === 'idle'" src/ui/app.tsx
   ```

2. **stdin listener intercepts Backspace** (`src/ui/components/input.tsx:77-100`):
   ```bash
   # Check if stdin.on('data') processes \x7f
   grep -A20 "stdin.on('data'" src/ui/components/input.tsx
   ```

3. **Multiple useInput hooks conflict**:
   ```bash
   # Count useInput calls
   rg -c "useInput\(" src/ui/
   ```

### Phase 3: Nuclear Option (If Debug Shows Nothing)

**Replace entire useInput with logging**:
```typescript
useInput((input, key) => {
  console.error('INPUT:', JSON.stringify(input), 'BACKSPACE:', key.backspace);
  // ... rest of handler
}, { isActive: true }); // Force true, ignore prop
```

Then check terminal stderr for logs.

---

## Acceptance Criteria

- User types text
- User presses Backspace
- Character before cursor deletes
- Cursor moves left
- Works in GNOME Terminal AND tmux
- Works whether tool outputs exist or not

---

## Files Modified (PR #11)

- `src/ui/components/input.tsx` - Backspace detection + debug overlay
- `src/ui/app.tsx` - Tool navigation handler + isActive prop
- `src/ui/utils/input-editor.ts` - deleteBackward/deleteForward logic
- `tests/unit/input-editor.test.ts` - Byte code tests

---

## Next Steps for Codex Team

**IMMEDIATE**: Get user to paste debug output (Ctrl+D in grok).

**Based on debug output**:
- **If shows BACKSPACE action but no state change** → State immutability bug
- **If shows FILTERED** → Wrong byte sequence detection
- **If shows nothing** → useInput not firing (ordering/isActive issue)
- **If shows SKIP: pasting** → stdin listener consuming bytes

**Fallback**: Disable App-level useInput temporarily to isolate issue.
