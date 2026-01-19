## Summary

Adds interactive command palette with autocomplete, keyboard navigation, fuzzy matching, and "did you mean" suggestions.

**Problem**: Typing `/` in Grok TUI shows nothing - users must already know command names. No autocomplete, no command discovery, no typo assistance.

**Solution**: Interactive command palette that appears when typing `/`, with smart filtering and keyboard navigation.

## Features

### 1. Live Command Filtering

Type `/` to see all commands, then filter as you type:

```
> /
┌─ Commands (7 matches) ─┐
▶ /auth - Authentication management
  /clear - Clear conversation
  /exit - Exit application
  /help - Show help
  /history - Show conversation history
  /model - Set AI model
  /prompt - Load prompt from file
└─────────────────────────┘
Tab: autocomplete • ↑/↓: navigate • Esc: close • Enter: submit
```

### 2. Smart Matching

**Prefix match**:
```
> /pr
┌─ Commands (1 match) ─┐
▶ /prompt - Load prompt from file
└───────────────────────┘
```

**Alias match**:
```
> /pf
┌─ Commands (1 match) ─┐
▶ /prompt (via pf) - Load prompt from file
└────────────────────────────────────────┘
```

**Fuzzy match** (typo tolerance):
```
> /promt
┌─ Commands (1 match) ─┐
▶ /prompt - Load prompt from file
└───────────────────────┘
```

### 3. Keyboard Navigation

- **↑/↓**: Navigate suggestions (only when palette visible)
- **Tab**: Autocomplete to selected command + add space
- **Esc**: Close palette
- **Enter**: Submit command as usual

### 4. "Did You Mean" for Unknown Commands

```
> /promt myfile.txt
[Enter]

Error: Unknown command: /promt

Did you mean: /prompt?

Use /help to see all available commands.
```

## Implementation

### Phase 1: Suggestion Algorithm (`src/ui/utils/command-suggestions.ts`)

**Levenshtein Distance**:
- Calculates edit distance for fuzzy matching
- Tolerates up to 2 character edits
- No external dependencies (30 lines, pure algorithm)

**Matching Types** (ranked):
1. **Exact** (1000 points): `/prompt` → `prompt`
2. **Prefix** (900 points): `/pr` → `prompt`
3. **Alias Exact** (800 points): `/pf` → `prompt`
4. **Alias Prefix** (700 points): `/promptf` → `prompt` (via `promptfile`)
5. **Substring** (600 points): `/odel` → `model`
6. **Fuzzy** (500-distance*100): `/promt` → `prompt` (1 edit = 400 points)

### Phase 2: UI Component (`src/ui/components/command-palette.tsx`)

- Cyan bordered box (consistent with tool selection)
- Selected item: inverse text + bold + arrow indicator
- Shows matched alias when applicable
- Keyboard hint at bottom

### Phase 3: Input Integration (`src/ui/components/input.tsx`)

- Computes suggestions in real-time (`useMemo`)
- Shows palette when `value.startsWith('/')` and not pasting
- Arrow keys captured when palette visible (priority over tool navigation)
- Tab autocompletes and preserves any args already typed
- Escape closes palette without clearing input

### Phase 4: Error Enhancement (`src/commands/index.ts`)

- Unknown command errors now include fuzzy suggestion
- Uses `getDidYouMeanSuggestion()` for best match
- Shows alias if matched via alias

## Compatibility

**No conflicts with existing features**:
- ✅ Bracketed paste: Palette hidden during `isPasting`
- ✅ Tool navigation: Only captures arrows when palette visible (tool nav when `isActive=false`)
- ✅ Multi-line input: Palette respects multi-line display
- ✅ Command execution: Unchanged behavior

## Test Coverage

**New Test File**: `tests/unit/command-suggestions.test.ts` (25 tests)

- Levenshtein distance correctness (7 tests)
- Suggestion matching (exact, prefix, alias, substring, fuzzy) (12 tests)
- Ranking and sorting (2 tests)
- "Did you mean" logic (4 tests)

**Test Results**: 238/238 pass (+25 from 213)

## Verification

```bash
✅ npm run build - TypeScript compilation clean
✅ npm test - 238/238 tests pass (+25 new tests)
✅ No conflicts with paste/navigation modes
```

## Manual Testing

After merge, verify in TUI:

1. **Discovery**: Type `/` → see all 7 commands
2. **Filter**: Type `/pr` → see `/prompt`
3. **Alias**: Type `/pf` → matches `/prompt (via pf)`
4. **Fuzzy**: Type `/promt` → matches `/prompt`
5. **Navigate**: Press ↓/↑ → selection moves
6. **Autocomplete**: Press Tab → completes to `/prompt `
7. **Typo Help**: Submit `/promt` → error shows "Did you mean: /prompt?"

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
