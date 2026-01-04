# grok-cli Command System Implementation Plan

**Goal:** Implement Claude Code-style command system in grok-cli

**Research Complete:** 3 Opus agents analyzed Claude Code's 40+ commands, architecture patterns, and Grok model options

---

## Available Grok Models

| Model | Context | Cost (Input/Output) | Speed | Best For |
|-------|---------|---------------------|-------|----------|
| **grok-4-1-fast** | 2M | $0.20/$0.50 per 1M | Fast | CLI tools, coding (DEFAULT) |
| grok-4 | 2M | $2.00/$10.00 per 1M | Slower | Complex reasoning |
| grok-4-1 | 2M | $2.00/$10.00 per 1M | Slower | Production stable |
| grok-beta | 128K | $5.00/$15.00 per 1M | Medium | Legacy |
| grok-vision-beta | 8K | $5.00/$15.00 per 1M | Medium | Images |

---

## Prioritized Implementation (3 Phases)

### 🎯 Phase 1: Essential Commands (RECOMMENDED START)

**Impact:** HIGH - Core usability features
**Effort:** 4-6 hours
**Files:** 8 new files, 2 modified

**Commands to implement:**
1. `/model [name]` - Switch models or show current
2. `/clear` - Clear conversation history
3. `/help` - Show available commands
4. `/exit` - Exit CLI (alias for existing exit/quit)
5. `/history` - Show message count/stats

**CLI Flags:**
- `--model <name>` - Set model at startup (already exists, enhance)
- `--help` - Show help
- `--version` - Show version

**Architecture:**
- Create `src/commands/` module
- Add command parser in `App.handleSubmit()`
- Add model state management in `App`
- Create command handlers

---

### 🔧 Phase 2: Session Management (MEDIUM PRIORITY)

**Impact:** MEDIUM - Productivity for multi-session workflows
**Effort:** 6-8 hours
**Files:** 5 new files, 1 modified

**Commands:**
1. `/session save [name]` - Save current session
2. `/session list` - List saved sessions
3. `/resume <id>` - Resume previous session
4. `/rename <name>` - Rename current session

**CLI Flags:**
- `--resume <id>` - Resume at startup
- `--session <name>` - Name the session

**Architecture:**
- Create `src/session/` module (already exists, enhance)
- Implement SessionManager with file storage
- Add session restoration in App
- Session picker UI component

---

### ⚡ Phase 3: Advanced Features (FUTURE)

**Impact:** LOW-MEDIUM - Nice-to-have features
**Effort:** 10+ hours
**Files:** 10+ new files

**Commands:**
1. `/cost` - Show token usage/costs
2. `/context` - Show context usage
3. `/compact` - Condense conversation
4. `/export <file>` - Export conversation
5. `/memory` - Edit GROK.md files
6. Custom slash commands (`.grok/commands/*.md`)

**CLI Flags:**
- `--verbose` - Verbose logging
- `--max-turns` - Limit agent rounds
- `--allowedTools` - Pre-approve tools

---

## Recommended Files to Create (Phase 1)

### Core Command Infrastructure (3 files)

1. **`src/commands/types.ts`** (~80 lines)
```typescript
export interface CommandContext {
  currentModel: string;
  messages: Message[];
  setModel: (model: string) => void;
  clearMessages: () => void;
  addSystemMessage: (content: string) => void;
  exit: () => void;
}

export interface CommandResult {
  type: 'success' | 'error' | 'help';
  message?: string;
  preventAgentRun?: boolean;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  execute: (args: string[], ctx: CommandContext) => CommandResult | Promise<CommandResult>;
}
```

2. **`src/commands/parser.ts`** (~60 lines)
```typescript
export function isCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

export function parseCommand(input: string): ParsedCommand | null {
  // Extract command name and arguments
  // Handle quoted strings
  // Return { name, args, rawArgs }
}
```

3. **`src/commands/index.ts`** (~50 lines)
```typescript
import { ModelCommand, ClearCommand, HelpCommand } from './handlers/index.js';

const commands = [
  new ModelCommand(),
  new ClearCommand(),
  new HelpCommand(),
];

export function executeCommand(parsed, context) {
  const cmd = findCommand(parsed.name);
  if (!cmd) return error result;
  return cmd.execute(parsed.args, context);
}
```

### Command Handlers (5 files)

4. **`src/commands/handlers/model.ts`** (~100 lines)
5. **`src/commands/handlers/clear.ts`** (~30 lines)
6. **`src/commands/handlers/help.ts`** (~80 lines)
7. **`src/commands/handlers/exit.ts`** (~20 lines)
8. **`src/commands/handlers/history.ts`** (~50 lines)

### Config Enhancement (1 file)

9. **`src/config/models.ts`** (~120 lines)
```typescript
export const MODELS = {
  'grok-4-1-fast': {
    name: 'grok-4-1-fast',
    description: 'Fast, efficient (RECOMMENDED)',
    contextWindow: 2000000,
    aliases: ['fast', 'default'],
  },
  'grok-4': {...},
  // etc
};

export function resolveModelAlias(alias: string): string {
  // Handle aliases: 'fast' -> 'grok-4-1-fast'
}
```

### Modified Files (2 files)

10. **`src/ui/app.tsx`** - Add command routing, model state
11. **`src/index.tsx`** - Enhanced CLI arg parsing

---

## Integration Points

### 1. App.tsx Modifications

```typescript
// Add model state
const [currentModel, setCurrentModel] = useState(initialModel || 'grok-4-1-fast');

// Recreate agent on model switch
const agentRef = useRef<GrokAgent | null>(null);
useEffect(() => {
  agentRef.current = new GrokAgent({ model: currentModel });
}, [currentModel]);

// Add command routing in handleSubmit
const handleSubmit = useCallback(async (value: string) => {
  // Existing exit check
  if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
    exit();
    return;
  }

  // NEW: Check for slash commands
  if (isCommand(value)) {
    const parsed = parseCommand(value);
    if (parsed) {
      const context = createCommandContext();
      const result = await executeCommand(parsed, context);

      if (result.message) {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'system',
          content: result.message
        }]);
      }

      if (result.preventAgentRun) {
        return;  // Don't send to agent
      }
    }
  }

  // Existing agent flow
  setMessages(prev => [...prev, { id: generateId(), role: 'user', content: value }]);
  runAgent(value);
}, [exit, runAgent]);
```

---

## Implementation Sequence (Phase 1)

**Estimated time: 4-6 hours**

1. ✅ Create `src/commands/types.ts`
2. ✅ Create `src/commands/parser.ts`
3. ✅ Create `src/config/models.ts`
4. ✅ Create `src/commands/handlers/clear.ts`
5. ✅ Create `src/commands/handlers/help.ts`
6. ✅ Create `src/commands/handlers/model.ts`
7. ✅ Create `src/commands/handlers/exit.ts`
8. ✅ Create `src/commands/handlers/history.ts`
9. ✅ Create `src/commands/index.ts`
10. ✅ Update `src/ui/app.tsx` (add command routing + model state)
11. ✅ Update `src/index.tsx` (add --help, --version flags)
12. ✅ Test all commands
13. ✅ Update GROK.md with command examples

---

## Success Criteria (Phase 1)

After implementation:
- [ ] `/model` - Shows current model and available models
- [ ] `/model fast` - Switches to grok-4-1-fast
- [ ] `/model grok-4` - Switches to grok-4
- [ ] `/clear` - Clears conversation history
- [ ] `/help` - Shows command list
- [ ] `/exit` - Exits CLI
- [ ] `/history` - Shows message count
- [ ] `grok --help` - Displays help
- [ ] `grok --version` - Shows version
- [ ] `grok --model grok-4 "prompt"` - Starts with specified model
- [ ] Model switching works mid-session
- [ ] Backwards compatible (regular prompts still work)

---

## Questions for Scope Definition

**Which phase do you want to implement first?**

**A) Phase 1 Only (Essential - 8 files, 4-6 hours)**
- /model, /clear, /help, /exit, /history
- --model, --help, --version flags
- Core command infrastructure
- **Recommended start** - gets 80% of value

**B) Phase 1 + Phase 2 (Sessions - 13 files, 10-14 hours)**
- Everything from Phase 1
- Plus: /session, /resume commands
- Plus: --resume flag
- Full session management

**C) All Phases (40+ files, 20+ hours)**
- Complete Claude Code parity
- /cost, /context, /compact, /export, custom commands
- All advanced flags
- **Very ambitious** - save for later iterations

**My recommendation: Start with Phase 1 (Option A) - it provides the essential commands users expect and we can iterate from there.**

---

**Ready to proceed?** Which phase scope should I implement?
