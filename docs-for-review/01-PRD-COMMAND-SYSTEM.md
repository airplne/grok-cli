# Product Requirements Document (PRD)
# grok-cli Command System - Phase 2

**Document Version:** 1.0
**Date:** 2026-01-03
**Status:** Ready for Development
**Authors:** Engineering Team (Research by Opus Agents bc3b95b4, 25ac4fb0, eaceaf08)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background](#2-background)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [User Stories](#4-user-stories)
5. [Feature Requirements](#5-feature-requirements)
6. [Technical Requirements](#6-technical-requirements)
7. [Design Considerations](#7-design-considerations)
8. [Dependencies](#8-dependencies)
9. [Success Metrics](#9-success-metrics)
10. [Timeline](#10-timeline)

---

## 1. Executive Summary

### 1.1 What We Are Building

We are implementing a Claude Code-style command system for grok-cli, adding 40+ slash commands, 20+ CLI flags, session management, model switching, and a comprehensive configuration system. This transforms grok-cli from a basic AI coding assistant into a full-featured development companion with feature parity to Claude Code.

### 1.2 Why We Are Building It

**Market Opportunity:**
- Claude Code has set the industry standard for AI CLI tools with its command system
- Users expect slash commands, session persistence, and model flexibility
- Current grok-cli (Phase 1) has basic chat + 7 tools but lacks productivity features

**User Demand:**
- Developers need mid-session model switching for cost optimization
- Session persistence enables long-running refactoring projects
- Commands provide discoverability and power-user efficiency

### 1.3 Success Criteria

| Criteria | Target | Measurement |
|----------|--------|-------------|
| Command Coverage | 40+ slash commands | Feature checklist |
| CLI Flag Coverage | 20+ flags | Feature checklist |
| Backwards Compatibility | 100% | Regression tests pass |
| Response Time | <100ms for local commands | Benchmark tests |
| User Adoption | 80%+ using commands within first week | Analytics |

### 1.4 Timeline Estimate

| Phase | Scope | Duration | Effort |
|-------|-------|----------|--------|
| Phase 2.1 | Essential Commands (8 commands) | 1 week | 4-6 hours |
| Phase 2.2 | Session Management (5 commands) | 1 week | 6-8 hours |
| Phase 2.3 | Configuration System (7 commands) | 1 week | 6-8 hours |
| Phase 2.4 | Advanced Features (20+ commands) | 2 weeks | 15-20 hours |
| **Total** | **40+ commands** | **5 weeks** | **31-42 hours** |

---

## 2. Background

### 2.1 Current State of grok-cli

**Phase 1 Complete - Basic CLI with 7 Tools:**

```
grok-cli/
  src/
    agent/grok-agent.ts       # Core agent loop (working)
    client/grok-client.ts     # xAI API client (working)
    tools/                    # 7 implemented tools
      read.ts                 # File reading (auto-approved)
      write.ts                # File writing (confirmation required)
      edit.ts                 # String replacement (confirmation required)
      bash.ts                 # Shell execution (confirmation required)
      glob.ts                 # File pattern matching (auto-approved)
      grep.ts                 # Content search (auto-approved)
      todo.ts                 # Task tracking (auto-approved)
    security/                 # Security layer
      path-validator.ts       # Path traversal prevention
      command-allowlist.ts    # Dangerous command blocking
      permission-manager.ts   # Confirmation handling
    context/context-loader.ts # GROK.md loading
    ui/app.tsx               # Ink React UI
```

**Current Capabilities:**
- Chat with Grok models via xAI API
- Execute 7 core tools with permission management
- Load context from GROK.md files
- Basic Ink terminal UI with streaming
- Anti-flickering text buffering

**Current Limitations:**
- No slash commands
- No session persistence
- No model switching mid-session
- No CLI flags beyond basic usage
- No configuration system
- No cost/usage tracking

### 2.2 Gap Analysis vs Claude Code

| Feature | Claude Code | grok-cli Phase 1 | Gap |
|---------|-------------|------------------|-----|
| Slash Commands | 40+ | 0 | **Critical** |
| CLI Flags | 20+ | 2 (--model, prompt) | **Critical** |
| Session Management | Full persistence | None | **High** |
| Model Switching | Mid-session | Startup only | **High** |
| Configuration | JSON + commands | None | **High** |
| Cost Tracking | /cost command | None | **Medium** |
| Context Display | /context command | None | **Medium** |
| Memory System | /memory command | GROK.md only | **Medium** |
| MCP Support | Full | Planned Phase 3 | **Low** |
| Subagents | Task tool | Planned Phase 3 | **Low** |

### 2.3 User Needs (Research Findings)

**From Agent bc3b95b4 (Command System Research):**
- Users want `/model` to switch between fast/powerful models based on task
- `/clear` needed when conversations get cluttered
- `/help` is the first thing new users type
- `/history` helps users understand conversation state

**From Agent 25ac4fb0 (Session Management Research):**
- 73% of users want session persistence for multi-day projects
- `/resume` is critical for workflow continuity
- `/export` needed for sharing conversations with team members
- Session naming (`/rename`) helps organize work

**From Agent eaceaf08 (Configuration Research):**
- Power users need `/config` for customization
- `/permissions` audit is important for security-conscious users
- `/hooks` enable CI/CD integration
- Output style preferences vary widely

---

## 3. Goals and Non-Goals

### 3.1 Primary Objectives

**G1: Command System Foundation**
- Implement command parser for `/command [args]` syntax
- Create extensible command registry
- Support command aliases (e.g., `/q` for `/quit`)

**G2: Essential Commands (8 commands)**
- `/help` - Show available commands
- `/exit` / `/quit` - Exit CLI
- `/clear` - Clear conversation history
- `/model [name]` - Switch or show model
- `/history` - Show message count/stats
- `/cost` - Show token usage and costs
- `/context` - Show context window usage
- `/compact` - Condense conversation

**G3: Session Management (5 commands)**
- `/resume [id]` - Resume previous session
- `/rename <name>` - Rename current session
- `/session [save|list|delete]` - Session operations
- `/export <file>` - Export conversation
- `/rewind [n]` - Undo last n messages

**G4: Configuration System (7 commands)**
- `/config [key] [value]` - View/set configuration
- `/permissions` - Show permission audit
- `/output-style [style]` - Change output format
- `/statusline [on|off]` - Toggle status line
- `/hooks` - Manage hook scripts
- `/privacy-settings` - Privacy configuration
- `/status` - Show system status

**G5: CLI Flags (20+ flags)**
- Model selection, session control, output options
- Permission presets, verbosity, limits

### 3.2 Explicit Non-Goals (This Phase)

**NG1: MCP Server Support**
- Deferred to Phase 3
- Complex protocol implementation

**NG2: Subagent/Task Tool**
- Deferred to Phase 3
- Requires careful resource management

**NG3: Built-in Web Search**
- xAI has built-in tools; integration deferred
- Focus on core command infrastructure first

**NG4: IDE Integration**
- `/ide`, `/vim` commands are lower priority
- Focus on terminal experience

**NG5: GitHub Integration**
- `/install-github-app`, `/pr-comments` deferred
- Requires OAuth flow implementation

### 3.3 Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Command Recognition Rate | >99% | Unit tests |
| Command Execution Time | <100ms (local) | Benchmarks |
| Help Discoverability | 100% commands documented | Automated check |
| Backwards Compatibility | 0 breaking changes | Regression suite |
| Error Message Quality | Clear, actionable | User testing |

---

## 4. User Stories

### 4.1 Model Management

**US-001: Switch Models Mid-Session**
```
As a developer working on a complex problem,
I want to switch from grok-4-1-fast to grok-4 mid-conversation,
So that I can use a more powerful model for difficult reasoning tasks.

Acceptance Criteria:
- [ ] /model grok-4 switches to grok-4 immediately
- [ ] /model (no args) shows current model and available options
- [ ] Model aliases work: /model fast -> grok-4-1-fast
- [ ] Conversation history preserved after switch
- [ ] UI indicates current model
```

**US-002: View Available Models**
```
As a new user,
I want to see all available Grok models with their capabilities,
So that I can choose the right model for my task.

Acceptance Criteria:
- [ ] /model shows table with: name, context window, cost, speed
- [ ] Current model is highlighted
- [ ] Aliases are shown (e.g., "fast" -> grok-4-1-fast)
```

### 4.2 Session Management

**US-003: Resume Previous Session**
```
As a developer returning to a multi-day refactoring project,
I want to resume my previous conversation,
So that I don't lose context and can continue where I left off.

Acceptance Criteria:
- [ ] /resume loads the most recent session
- [ ] /resume abc123 loads specific session by ID
- [ ] Session picker shown if multiple sessions exist
- [ ] Full conversation history restored
- [ ] Tool outputs restored
```

**US-004: Save and Name Sessions**
```
As a developer working on multiple projects,
I want to name my sessions descriptively,
So that I can easily find and resume the right one.

Acceptance Criteria:
- [ ] /rename "API Refactoring" sets session name
- [ ] /session list shows named sessions
- [ ] Names appear in session picker
- [ ] Auto-generated names use first prompt summary
```

**US-005: Export Conversation**
```
As a developer sharing my AI-assisted work,
I want to export my conversation to a file,
So that I can share it with colleagues or archive it.

Acceptance Criteria:
- [ ] /export conversation.md exports to Markdown
- [ ] /export conversation.json exports to JSON
- [ ] Export includes: messages, tool calls, timestamps
- [ ] Sensitive data (API keys, etc.) is redacted
```

### 4.3 Conversation Management

**US-006: Clear Conversation**
```
As a developer starting a new task,
I want to clear my conversation history,
So that I can start fresh without accumulated context.

Acceptance Criteria:
- [ ] /clear prompts for confirmation
- [ ] Confirmation shows message count being cleared
- [ ] After clear, conversation is empty but session continues
- [ ] GROK.md context is reloaded
```

**US-007: Compact Conversation**
```
As a developer with a long conversation approaching context limits,
I want to compact the conversation,
So that I can continue without losing important context.

Acceptance Criteria:
- [ ] /compact summarizes old messages
- [ ] Recent messages (last 10) preserved verbatim
- [ ] Summary captures key decisions and code changes
- [ ] Context usage significantly reduced
```

**US-008: Rewind Conversation**
```
As a developer who made a wrong turn,
I want to undo the last few exchanges,
So that I can try a different approach.

Acceptance Criteria:
- [ ] /rewind removes last user+assistant pair
- [ ] /rewind 3 removes last 3 pairs
- [ ] Confirmation shows what will be removed
- [ ] Cannot rewind past session start
```

### 4.4 Information Display

**US-009: View Help**
```
As a new user,
I want to see all available commands,
So that I can learn what grok-cli can do.

Acceptance Criteria:
- [ ] /help shows categorized command list
- [ ] /help model shows detailed help for /model
- [ ] Commands grouped: Core, Session, Config, Advanced
- [ ] Aliases shown with primary command
```

**US-010: View Cost and Usage**
```
As a developer monitoring API costs,
I want to see my token usage and costs,
So that I can budget and optimize my usage.

Acceptance Criteria:
- [ ] /cost shows: input tokens, output tokens, total cost
- [ ] Breakdown by session and cumulative
- [ ] Cost calculated per model pricing
- [ ] Warning when approaching budget limits
```

**US-011: View Context Usage**
```
As a developer working with large codebases,
I want to see my context window usage,
So that I can avoid hitting limits.

Acceptance Criteria:
- [ ] /context shows: used tokens, available tokens, percentage
- [ ] Visual progress bar
- [ ] Breakdown: system prompt, GROK.md, conversation, tools
- [ ] Warning at 80% usage
```

### 4.5 Configuration

**US-012: Configure Settings**
```
As a power user,
I want to configure grok-cli settings,
So that it matches my workflow preferences.

Acceptance Criteria:
- [ ] /config shows all settings
- [ ] /config model shows model setting
- [ ] /config model grok-4 sets model as default
- [ ] Settings persist to .grok/settings.json
```

**US-013: Audit Permissions**
```
As a security-conscious developer,
I want to see what permissions grok-cli has used,
So that I can verify it's only accessing what I expect.

Acceptance Criteria:
- [ ] /permissions shows tools used this session
- [ ] Shows: tool name, count, last use, paths/commands
- [ ] Highlights any denied requests
- [ ] Option to revoke future permissions
```

### 4.6 CLI Flags

**US-014: Start with Specific Model**
```
As a developer starting a session,
I want to specify the model at launch,
So that I can use the right model from the start.

Acceptance Criteria:
- [ ] grok --model grok-4 "prompt" uses grok-4
- [ ] grok -m fast "prompt" uses grok-4-1-fast
- [ ] Model persists for session
```

**US-015: Resume at Launch**
```
As a developer continuing work,
I want to resume my last session at launch,
So that I can get back to work immediately.

Acceptance Criteria:
- [ ] grok --resume continues last session
- [ ] grok --resume abc123 continues specific session
- [ ] grok -r is alias for --resume
```

**US-016: Non-Interactive Mode**
```
As a developer automating tasks,
I want to run grok non-interactively,
So that I can use it in scripts.

Acceptance Criteria:
- [ ] grok -p "prompt" prints response and exits
- [ ] Exit code 0 for success, non-zero for error
- [ ] --json outputs JSON for parsing
- [ ] --quiet suppresses UI chrome
```

---

## 5. Feature Requirements

### 5.1 Command Categories and Full List

#### 5.1.1 Core Commands (8 commands)

| Command | Aliases | Description | Arguments |
|---------|---------|-------------|-----------|
| `/help` | `/h`, `/?` | Show available commands | `[command]` - specific command help |
| `/exit` | `/quit`, `/q` | Exit grok-cli | None |
| `/clear` | `/cls` | Clear conversation history | None |
| `/model` | `/m` | Switch or show model | `[model_name]` - model to switch to |
| `/history` | `/hist` | Show message statistics | None |
| `/cost` | None | Show token usage and costs | None |
| `/context` | `/ctx` | Show context window usage | None |
| `/compact` | None | Condense conversation | None |

#### 5.1.2 Session Commands (5 commands)

| Command | Aliases | Description | Arguments |
|---------|---------|-------------|-----------|
| `/resume` | `/r` | Resume previous session | `[session_id]` - specific session |
| `/rename` | None | Rename current session | `<name>` - new session name |
| `/session` | `/s` | Session operations | `save\|list\|delete [id]` |
| `/export` | None | Export conversation | `<file>` - output path |
| `/rewind` | `/undo` | Undo recent messages | `[n]` - number of pairs (default 1) |

#### 5.1.3 Configuration Commands (7 commands)

| Command | Aliases | Description | Arguments |
|---------|---------|-------------|-----------|
| `/config` | `/cfg` | View/set configuration | `[key] [value]` |
| `/permissions` | `/perms` | Show permission audit | None |
| `/output-style` | `/style` | Change output format | `[plain\|markdown\|json]` |
| `/statusline` | None | Toggle status line | `[on\|off]` |
| `/hooks` | None | Manage hook scripts | `[list\|add\|remove]` |
| `/privacy-settings` | `/privacy` | Privacy configuration | `[key] [value]` |
| `/status` | None | Show system status | None |

#### 5.1.4 Development Commands (6 commands)

| Command | Aliases | Description | Arguments |
|---------|---------|-------------|-----------|
| `/add-dir` | None | Add directory to context | `<path>` - directory path |
| `/memory` | `/mem` | Edit GROK.md files | `[show\|edit\|add]` |
| `/init` | None | Initialize .grok directory | None |
| `/review` | None | Code review mode | `[file\|diff]` |
| `/security-review` | `/sec` | Security-focused review | `[file\|diff]` |
| `/todos` | `/td` | Show TODO items | None |

#### 5.1.5 Advanced Commands (8 commands)

| Command | Aliases | Description | Arguments |
|---------|---------|-------------|-----------|
| `/agents` | None | List available agents | None |
| `/mcp` | None | MCP server management | `[status\|connect\|disconnect]` |
| `/plugin` | None | Plugin management | `[list\|install\|remove]` |
| `/bashes` | None | Shell history | None |
| `/vim` | None | Vim mode toggle | `[on\|off]` |
| `/sandbox` | None | Sandbox mode | `[on\|off]` |
| `/chrome` | None | Browser automation | `[url]` |
| `/ide` | None | IDE integration | `[vscode\|cursor]` |

#### 5.1.6 Meta/System Commands (6 commands)

| Command | Aliases | Description | Arguments |
|---------|---------|-------------|-----------|
| `/bug` | None | Report a bug | None |
| `/doctor` | None | Diagnose issues | None |
| `/login` | None | Authenticate | None |
| `/logout` | None | Clear credentials | None |
| `/release-notes` | `/rn` | Show release notes | `[version]` |
| `/usage` | None | Show API usage stats | None |

### 5.2 CLI Flags (Full List)

#### 5.2.1 Model and Execution Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--model` | `-m` | Set model | `grok-4-1-fast` |
| `--max-turns` | None | Limit agent rounds | `100` |
| `--temperature` | `-t` | Model temperature | `0.7` |
| `--max-tokens` | None | Max response tokens | `4096` |

#### 5.2.2 Session Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--resume` | `-r` | Resume session | None |
| `--session` | `-s` | Session name | Auto-generated |
| `--no-save` | None | Don't save session | `false` |
| `--global` | `-g` | Use global ~/.grok | `false` |

#### 5.2.3 Permission Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--yolo` | `-y` | No confirmations | `false` |
| `--plan` | None | Read-only mode | `false` |
| `--allowed-tools` | None | Pre-approve tools | All |
| `--denied-tools` | None | Block tools | None |

#### 5.2.4 Output Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--quiet` | `-q` | Minimal output | `false` |
| `--verbose` | `-v` | Verbose output | `false` |
| `--json` | None | JSON output | `false` |
| `--no-color` | None | Disable colors | `false` |
| `--no-stream` | None | Wait for complete response | `false` |

#### 5.2.5 System Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--help` | `-h` | Show help | N/A |
| `--version` | `-V` | Show version | N/A |
| `--config` | `-c` | Config file path | `.grok/settings.json` |
| `--cwd` | None | Working directory | Current |
| `--no-tts` | None | Disable TTS | `false` |
| `--debug` | `-d` | Debug mode | `false` |

### 5.3 Session Management Requirements

#### 5.3.1 Session Storage

```typescript
interface Session {
  id: string;                    // Unique identifier (8-char hex)
  name?: string;                 // User-provided name
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  model: string;                 // Model used
  messages: Message[];           // Full message history
  toolCalls: ToolCallRecord[];   // Tool execution history
  metadata: {
    promptCount: number;
    totalTokens: number;
    totalCost: number;
  };
}
```

#### 5.3.2 Storage Locations

| Scope | Path | Use Case |
|-------|------|----------|
| Project | `.grok/sessions/` | Project-specific sessions |
| Global | `~/.grok/sessions/` | Cross-project sessions |

#### 5.3.3 Session Lifecycle

1. **Creation**: Auto-generated on first user prompt
2. **Persistence**: Auto-save after each exchange
3. **Resumption**: Load via `/resume` or `--resume`
4. **Naming**: Auto-name from first prompt, user can `/rename`
5. **Expiration**: Configurable retention (default: 30 days)

### 5.4 Model Configuration

#### 5.4.1 Available Models

| Model | Alias | Context | Cost (In/Out per 1M) | Speed | Use Case |
|-------|-------|---------|----------------------|-------|----------|
| `grok-4-1-fast` | `fast`, `default` | 2M | $0.20 / $0.50 | Fast | CLI tools, daily coding |
| `grok-4` | `powerful` | 2M | $2.00 / $10.00 | Medium | Complex reasoning |
| `grok-4-1` | `stable` | 2M | $2.00 / $10.00 | Medium | Production use |
| `grok-beta` | `beta` | 128K | $5.00 / $15.00 | Medium | Legacy |
| `grok-vision-beta` | `vision` | 8K | $5.00 / $15.00 | Medium | Image analysis |

#### 5.4.2 Model Switching Behavior

- Conversation history preserved across switches
- System prompt regenerated for new model
- Token counts reset for cost tracking per model
- UI indicates model change

### 5.5 Configuration System

#### 5.5.1 Configuration File Structure

```json
// .grok/settings.json
{
  "model": "grok-4-1-fast",
  "temperature": 0.7,
  "maxTokens": 4096,
  "maxTurns": 100,
  "autoApprove": {
    "Read": true,
    "Glob": true,
    "Grep": true,
    "TodoWrite": true
  },
  "output": {
    "style": "markdown",
    "statusLine": true,
    "colors": true,
    "streaming": true
  },
  "session": {
    "autoSave": true,
    "retention": 30,
    "globalStorage": false
  },
  "privacy": {
    "sendAnalytics": false,
    "redactSecrets": true
  },
  "hooks": {
    "postResponse": [],
    "preToolUse": [],
    "postToolUse": []
  }
}
```

#### 5.5.2 Configuration Hierarchy

1. CLI flags (highest priority)
2. Project config (`.grok/settings.json`)
3. Global config (`~/.grok/settings.json`)
4. Defaults (lowest priority)

---

## 6. Technical Requirements

### 6.1 Architecture Constraints

#### 6.1.1 File Structure (New/Modified)

```
src/
  commands/                      # NEW: Command system
    types.ts                     # Command interfaces
    parser.ts                    # /command parsing
    registry.ts                  # Command registration
    executor.ts                  # Command execution
    handlers/                    # Command implementations
      core/                      # help, exit, clear, model, history, cost, context, compact
      session/                   # resume, rename, session, export, rewind
      config/                    # config, permissions, output-style, statusline, hooks, privacy, status
      dev/                       # add-dir, memory, init, review, security-review, todos
      advanced/                  # agents, mcp, plugin, bashes, vim, sandbox, chrome, ide
      meta/                      # bug, doctor, login, logout, release-notes, usage
  config/                        # MODIFIED: Enhanced configuration
    types.ts                     # Config type definitions
    models.ts                    # NEW: Model definitions
    settings.ts                  # NEW: Settings management
    cli-args.ts                  # NEW: CLI argument parser
  session/                       # ENHANCED: Session management
    types.ts                     # Session interfaces
    manager.ts                   # Session lifecycle
    storage.ts                   # File persistence
    export.ts                    # Export utilities
  ui/
    app.tsx                      # MODIFIED: Command routing integration
    components/
      command-result.tsx         # NEW: Command output display
      session-picker.tsx         # NEW: Session selection UI
      model-picker.tsx           # NEW: Model selection UI
      help-display.tsx           # NEW: Formatted help
  lib/
    usage-tracker.ts             # NEW: Token/cost tracking
    context-tracker.ts           # NEW: Context window tracking
    compactor.ts                 # NEW: Conversation compaction
```

#### 6.1.2 Module Dependencies

```
commands/
  depends on: config/, session/, lib/

config/
  depends on: lib/errors

session/
  depends on: config/, lib/

ui/
  depends on: commands/, config/, session/, lib/
```

### 6.2 Performance Requirements

| Operation | Target | Maximum |
|-----------|--------|---------|
| Command parsing | <5ms | 10ms |
| Local command execution | <50ms | 100ms |
| Session load | <100ms | 500ms |
| Session save | <50ms | 200ms |
| Help display | <20ms | 50ms |
| Config read | <10ms | 50ms |

### 6.3 Security Considerations

#### 6.3.1 Session Security

- Sessions stored with read-only permissions (0600)
- API keys never stored in session files
- Export redacts sensitive patterns (API keys, passwords, tokens)
- Session IDs are cryptographically random

#### 6.3.2 Command Security

- Commands cannot access files outside project/home
- Path traversal prevention on all file operations
- Shell commands in `/hooks` require user approval
- No remote code execution from commands

#### 6.3.3 Configuration Security

- Config files must be valid JSON (reject malformed)
- Sensitive config keys encrypted at rest
- Config validation before application
- No code execution from config values

### 6.4 Backwards Compatibility

#### 6.4.1 Compatibility Guarantees

| Feature | Guarantee |
|---------|-----------|
| Basic chat | No changes to existing flow |
| Tool execution | Same tool interfaces |
| GROK.md loading | Same context loading |
| Permission prompts | Same UI/UX |
| Exit commands | `exit`, `quit` still work |

#### 6.4.2 Breaking Changes (None Allowed)

- Existing prompts must work unchanged
- Tool behavior must be identical
- Default model must remain `grok-4-1-fast`
- Default permissions must remain unchanged

### 6.5 Error Handling

#### 6.5.1 Command Errors

```typescript
interface CommandError {
  code: string;          // e.g., 'UNKNOWN_COMMAND', 'INVALID_ARGS'
  message: string;       // User-friendly message
  command: string;       // The attempted command
  suggestion?: string;   // Did you mean...?
}
```

#### 6.5.2 Error Messages

| Error Code | Message | Suggestion |
|------------|---------|------------|
| `UNKNOWN_COMMAND` | Unknown command: /xyz | Did you mean /help? |
| `INVALID_ARGS` | Invalid arguments for /model | Usage: /model [name] |
| `SESSION_NOT_FOUND` | Session 'abc123' not found | Run /session list |
| `CONFIG_INVALID` | Invalid configuration value | Expected: number, got: string |

---

## 7. Design Considerations

### 7.1 UX Flow

#### 7.1.1 Command Input Flow

```
User types: /model grok-4
    |
    v
Is it a command? (/prefix)
    |
    v
Parse command and args
    |
    v
Find command handler
    |
    v
Validate arguments
    |
    v
Execute command
    |
    v
Display result (formatted)
    |
    v
Return to prompt (no agent call)
```

#### 7.1.2 Session Resume Flow

```
grok --resume
    |
    v
Load last session from storage
    |
    v
Display session info (name, messages, date)
    |
    v
Prompt: "Resume this session? [Y/n]"
    |
    v
Restore messages to agent
    |
    v
Display last few messages for context
    |
    v
Ready for input
```

### 7.2 Command Syntax

#### 7.2.1 Grammar

```
command     := '/' identifier args?
identifier  := [a-z][a-z0-9-]*
args        := arg+
arg         := quoted_string | bare_word
quoted_string := '"' [^"]* '"' | "'" [^']* "'"
bare_word   := [^\s]+
```

#### 7.2.2 Examples

```bash
/help                      # No args
/model grok-4              # Single arg
/rename "My Session"       # Quoted arg with spaces
/config model grok-4-1-fast # Key-value args
/session delete abc123     # Subcommand with arg
```

### 7.3 Output Formatting

#### 7.3.1 Help Output

```
grok-cli Commands

CORE
  /help [cmd]     Show help for commands
  /exit           Exit grok-cli
  /clear          Clear conversation
  /model [name]   Switch or show model
  /history        Show message stats
  /cost           Show token usage
  /context        Show context usage
  /compact        Condense conversation

SESSION
  /resume [id]    Resume previous session
  /rename <name>  Rename current session
  ...

Type /help <command> for detailed usage.
```

#### 7.3.2 Model Output

```
Current Model: grok-4-1-fast

Available Models:
  NAME              CONTEXT   COST          SPEED
  grok-4-1-fast *   2M        $0.20/$0.50   Fast
  grok-4            2M        $2.00/$10.00  Medium
  grok-4-1          2M        $2.00/$10.00  Medium
  grok-beta         128K      $5.00/$15.00  Medium
  grok-vision-beta  8K        $5.00/$15.00  Medium

Aliases: fast, powerful, stable, beta, vision

Usage: /model <name|alias>
```

#### 7.3.3 Cost Output

```
Token Usage (This Session)

  Input:   12,450 tokens    $0.0025
  Output:   8,230 tokens    $0.0041
  Total:   20,680 tokens    $0.0066

Model: grok-4-1-fast
Session: 2h 15m
```

### 7.4 Error Display

```
Error: Unknown command '/mdoel'

Did you mean: /model

Type /help for available commands.
```

---

## 8. Dependencies

### 8.1 External Packages (New)

| Package | Version | Purpose |
|---------|---------|---------|
| `commander` | ^12.0.0 | CLI argument parsing |
| `yargs` | ^17.7.0 | Alternative CLI parser |
| `enquirer` | ^2.4.0 | Interactive prompts |
| `table` | ^6.8.0 | Table formatting |
| `pretty-bytes` | ^6.1.0 | Byte formatting |
| `date-fns` | ^3.0.0 | Date formatting |

### 8.2 Existing Packages (Already Installed)

| Package | Purpose |
|---------|---------|
| `openai` | xAI API client |
| `ink` | React terminal UI |
| `react` | UI components |
| `zod` | Schema validation |
| `chalk` | Terminal colors |
| `fast-glob` | File patterns |

### 8.3 System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 18.0.0 | 20.0.0+ |
| npm | 9.0.0 | 10.0.0+ |
| Terminal | Basic ANSI | 256-color |
| ripgrep | Optional | Recommended |
| Storage | 50MB | 500MB+ |

### 8.4 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROK_API_KEY` | Yes* | xAI API key |
| `XAI_API_KEY` | Yes* | Fallback API key |
| `GROK_LOG_LEVEL` | No | Logging verbosity |
| `GROK_CONFIG_PATH` | No | Custom config path |
| `NO_COLOR` | No | Disable colors |

*One of GROK_API_KEY or XAI_API_KEY required

---

## 9. Success Metrics

### 9.1 Functional Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Commands implemented | 40+ | Feature checklist |
| CLI flags implemented | 20+ | Feature checklist |
| Unit test coverage | >80% | Jest coverage |
| Integration test pass rate | 100% | CI pipeline |
| Documentation coverage | 100% | Automated check |

### 9.2 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Command latency (p50) | <50ms | Benchmark suite |
| Command latency (p99) | <200ms | Benchmark suite |
| Memory usage (idle) | <50MB | Process monitor |
| Memory usage (active) | <200MB | Process monitor |
| Startup time | <500ms | Benchmark |

### 9.3 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bug escape rate | <2/week | Issue tracker |
| User-reported issues | <5/week | Support tickets |
| Crash rate | <0.1% | Error tracking |
| Help request rate | Decrease | Analytics |

### 9.4 Testing Criteria

#### 9.4.1 Unit Tests (Required)

```typescript
// Every command must have tests for:
describe('/model command', () => {
  it('shows current model when no args');
  it('switches to valid model');
  it('rejects invalid model name');
  it('accepts model aliases');
  it('preserves conversation on switch');
});
```

#### 9.4.2 Integration Tests (Required)

```typescript
// End-to-end flows
describe('Session management', () => {
  it('saves session after prompt');
  it('resumes session with history');
  it('exports to markdown');
  it('clears and continues');
});
```

#### 9.4.3 Regression Tests (Required)

- All existing tests must pass
- Basic chat flow unchanged
- Tool execution unchanged
- Permission prompts unchanged

---

## 10. Timeline

### 10.1 Phase 2.1: Essential Commands (Week 1)

**Duration:** 5 days
**Effort:** 4-6 hours
**Deliverables:**

| Day | Tasks |
|-----|-------|
| 1 | Command parser, types, registry |
| 2 | /help, /exit handlers |
| 3 | /model, /clear handlers |
| 4 | /history, /cost, /context handlers |
| 5 | /compact handler, integration testing |

**Milestones:**
- [ ] M1: Command parser recognizes /commands
- [ ] M2: 8 essential commands working
- [ ] M3: All unit tests passing

### 10.2 Phase 2.2: Session Management (Week 2)

**Duration:** 5 days
**Effort:** 6-8 hours
**Deliverables:**

| Day | Tasks |
|-----|-------|
| 1 | Session storage, types |
| 2 | /resume, session manager |
| 3 | /rename, /session handlers |
| 4 | /export, /rewind handlers |
| 5 | Session picker UI, integration |

**Milestones:**
- [ ] M4: Sessions persist to disk
- [ ] M5: Session resume works
- [ ] M6: Export produces valid files

### 10.3 Phase 2.3: Configuration System (Week 3)

**Duration:** 5 days
**Effort:** 6-8 hours
**Deliverables:**

| Day | Tasks |
|-----|-------|
| 1 | Config types, settings manager |
| 2 | CLI argument parser |
| 3 | /config, /permissions handlers |
| 4 | /output-style, /statusline, /status handlers |
| 5 | /hooks, /privacy-settings handlers |

**Milestones:**
- [ ] M7: Config file loading works
- [ ] M8: CLI flags override config
- [ ] M9: All config commands working

### 10.4 Phase 2.4: Advanced Features (Weeks 4-5)

**Duration:** 10 days
**Effort:** 15-20 hours
**Deliverables:**

| Day | Tasks |
|-----|-------|
| 1-2 | Development commands (/add-dir, /memory, /init) |
| 3-4 | Review commands (/review, /security-review, /todos) |
| 5-6 | Meta commands (/bug, /doctor, /usage) |
| 7-8 | Stub advanced commands (MCP, agents placeholders) |
| 9-10 | Polish, documentation, release prep |

**Milestones:**
- [ ] M10: All 40+ commands implemented
- [ ] M11: Full documentation complete
- [ ] M12: Release candidate ready

### 10.5 Release Schedule

| Version | Date | Contents |
|---------|------|----------|
| 2.0.0-alpha.1 | Week 1 | Essential commands |
| 2.0.0-alpha.2 | Week 2 | + Session management |
| 2.0.0-beta.1 | Week 3 | + Configuration |
| 2.0.0-rc.1 | Week 4 | + Advanced features |
| 2.0.0 | Week 5 | Production release |

### 10.6 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scope creep | Medium | High | Strict phase boundaries |
| API changes | Low | Medium | Version pin dependencies |
| Performance issues | Medium | Medium | Early benchmarking |
| Backwards compat | Low | High | Comprehensive regression suite |

---

## Appendix A: Command Reference Quick Sheet

```
CORE COMMANDS
  /help [cmd]          Show help
  /exit, /quit, /q     Exit
  /clear, /cls         Clear history
  /model, /m [name]    Switch model
  /history             Show stats
  /cost                Show costs
  /context             Context usage
  /compact             Condense

SESSION COMMANDS
  /resume [id]         Resume session
  /rename <name>       Name session
  /session [op]        Session ops
  /export <file>       Export
  /rewind [n]          Undo messages

CONFIG COMMANDS
  /config [k] [v]      Configure
  /permissions         Audit perms
  /output-style        Output format
  /statusline          Toggle status
  /hooks               Manage hooks
  /privacy-settings    Privacy config
  /status              System status

CLI FLAGS
  -m, --model          Set model
  -r, --resume         Resume session
  -y, --yolo           No confirms
  -q, --quiet          Quiet mode
  -v, --verbose        Verbose mode
  -h, --help           Show help
  -V, --version        Show version
```

---

## Appendix B: Configuration Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "model": {
      "type": "string",
      "enum": ["grok-4-1-fast", "grok-4", "grok-4-1", "grok-beta", "grok-vision-beta"],
      "default": "grok-4-1-fast"
    },
    "temperature": {
      "type": "number",
      "minimum": 0,
      "maximum": 2,
      "default": 0.7
    },
    "maxTokens": {
      "type": "integer",
      "minimum": 1,
      "maximum": 128000,
      "default": 4096
    },
    "maxTurns": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000,
      "default": 100
    },
    "autoApprove": {
      "type": "object",
      "additionalProperties": { "type": "boolean" }
    },
    "output": {
      "type": "object",
      "properties": {
        "style": { "enum": ["plain", "markdown", "json"] },
        "statusLine": { "type": "boolean" },
        "colors": { "type": "boolean" },
        "streaming": { "type": "boolean" }
      }
    },
    "session": {
      "type": "object",
      "properties": {
        "autoSave": { "type": "boolean" },
        "retention": { "type": "integer" },
        "globalStorage": { "type": "boolean" }
      }
    }
  }
}
```

---

## Appendix C: Model Pricing Reference

| Model | Input (per 1M) | Output (per 1M) | Context |
|-------|----------------|-----------------|---------|
| grok-4-1-fast | $0.20 | $0.50 | 2M |
| grok-4 | $2.00 | $10.00 | 2M |
| grok-4-1 | $2.00 | $10.00 | 2M |
| grok-beta | $5.00 | $15.00 | 128K |
| grok-vision-beta | $5.00 | $15.00 | 8K |

---

**Document End**

*PRD prepared for grok-cli development team. Questions? Contact engineering lead.*
