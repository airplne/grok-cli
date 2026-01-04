# User Stories: grok-cli Command System

**Document Version:** 1.0
**Date:** 2026-01-03
**Status:** Ready for Development
**Product:** grok-cli Phase 2 - Command System

---

## Table of Contents

1. [Epic 1: Model Management](#epic-1-model-management)
2. [Epic 2: Session Management](#epic-2-session-management)
3. [Epic 3: Conversation Management](#epic-3-conversation-management)
4. [Epic 4: Help System](#epic-4-help-system)
5. [Epic 5: Configuration](#epic-5-configuration)
6. [Epic 6: Usage Tracking](#epic-6-usage-tracking)
7. [Epic 7: Development Tools](#epic-7-development-tools)
8. [Epic 8: CLI Flag Parsing](#epic-8-cli-flag-parsing)
9. [Epic 9: Backwards Compatibility](#epic-9-backwards-compatibility)

---

## Epic 1: Model Management

### User Story: US-001 - Model Switching (/model command)

**As a** developer working on tasks of varying complexity
**I want** to switch between Grok models mid-conversation
**So that** I can use fast models for simple tasks and powerful models for complex reasoning

#### Acceptance Criteria
- [ ] `/model` (no arguments) displays current model and list of available models
- [ ] `/model <name>` switches to the specified model immediately
- [ ] Model aliases work (e.g., `/model fast` -> `grok-4-1-fast`)
- [ ] Invalid model names produce clear error with suggestions
- [ ] Conversation history is preserved after model switch
- [ ] UI status bar updates to reflect current model
- [ ] Model switch confirmation message displayed

#### Technical Notes
- Implementation file: `src/commands/handlers/core/model.ts`
- Available models: `grok-4-1-fast`, `grok-4`, `grok-4-1`, `grok-beta`, `grok-vision-beta`
- Aliases: `fast` -> `grok-4-1-fast`, `powerful` -> `grok-4`, `stable` -> `grok-4-1`
- Agent instance must be recreated with new model configuration
- Token counters should reset for cost tracking per model segment
- Edge case: Handle model switch while streaming response (queue for after completion)

#### Priority
- **HIGH** - Core feature for cost optimization and task-appropriate model selection

#### Effort
- **M** (3 hours)
  - Model registry with aliases: 1 hour
  - Command handler implementation: 1 hour
  - UI integration and testing: 1 hour

---

### User Story: US-002 - View Available Models

**As a** new user exploring grok-cli capabilities
**I want** to see all available Grok models with their specifications
**So that** I can make informed decisions about which model to use

#### Acceptance Criteria
- [ ] Model list shows: name, context window size, pricing (input/output per 1M tokens), speed rating
- [ ] Current model is clearly highlighted/marked with indicator
- [ ] Aliases are displayed alongside primary model names
- [ ] Table is well-formatted and readable in terminal
- [ ] Model recommendations shown for different use cases

#### Technical Notes
- Implementation file: `src/config/models.ts`
- Display format: ASCII table with aligned columns
- Include use case hints: "Fast" for CLI tools, "Powerful" for complex reasoning
- Model data should be centralized for easy updates when new models released

#### Priority
- **HIGH** - Essential for user onboarding and model selection

#### Effort
- **S** (1 hour)
  - Part of /model command implementation

---

## Epic 2: Session Management

### User Story: US-003 - Save Session (/session save)

**As a** developer working on a long-running project
**I want** to save my conversation session with a descriptive name
**So that** I can return to it later and maintain context across work sessions

#### Acceptance Criteria
- [ ] `/session save [name]` saves current session to disk
- [ ] Auto-generated name if not provided (based on first prompt summary)
- [ ] Session includes: messages, tool calls, model used, timestamps, metadata
- [ ] Confirmation message with session ID and storage location
- [ ] Sessions stored in `.grok/sessions/` (project) or `~/.grok/sessions/` (global)
- [ ] Session files use secure permissions (0600)

#### Technical Notes
- Implementation files: `src/session/manager.ts`, `src/session/storage.ts`
- Session ID: 8-character cryptographically random hex string
- Storage format: JSON with gzip compression for large sessions
- Auto-save after each exchange (configurable via `/config session.autoSave`)
- Edge case: Handle disk full errors gracefully
- Edge case: Concurrent saves from multiple terminals

#### Priority
- **HIGH** - Critical for multi-day project workflows

#### Effort
- **L** (5 hours)
  - Session types and interfaces: 1 hour
  - Storage implementation: 2 hours
  - Command handlers: 1 hour
  - Integration and testing: 1 hour

---

### User Story: US-004 - Resume Session (/resume)

**As a** developer returning to a previous project
**I want** to resume my saved conversation session
**So that** I can continue where I left off without losing context

#### Acceptance Criteria
- [ ] `/resume` loads the most recent session
- [ ] `/resume <id>` loads specific session by ID
- [ ] `/resume <name>` loads session by name (partial match supported)
- [ ] Session picker UI shown when multiple matches found
- [ ] Full conversation history restored including tool outputs
- [ ] Session metadata displayed: name, date, message count, model
- [ ] Confirmation prompt before loading large sessions

#### Technical Notes
- Implementation file: `src/commands/handlers/session/resume.ts`
- Display last 3-5 messages after resume for context
- CLI flag: `--resume` / `-r` for startup resume
- Edge case: Handle corrupted session files
- Edge case: Handle sessions from incompatible versions
- Session picker: Interactive list with arrow key navigation (Ink)

#### Priority
- **HIGH** - Essential for workflow continuity

#### Effort
- **M** (3 hours)
  - Session loading logic: 1 hour
  - Session picker UI component: 1 hour
  - Integration and edge cases: 1 hour

---

### User Story: US-005 - List Sessions (/session list)

**As a** developer managing multiple project sessions
**I want** to see all my saved sessions
**So that** I can find and resume the right one

#### Acceptance Criteria
- [ ] `/session list` displays all saved sessions in table format
- [ ] Shows: ID, name, date created, last updated, message count, model
- [ ] Sessions sorted by last updated (most recent first)
- [ ] Supports filtering: `/session list --project` (current project only)
- [ ] Supports filtering: `/session list --global` (global sessions only)
- [ ] Empty state message when no sessions exist

#### Technical Notes
- Implementation file: `src/commands/handlers/session/session.ts`
- Scan both `.grok/sessions/` and `~/.grok/sessions/`
- Cache session list for performance (invalidate on changes)
- Pagination for large session lists (>20 sessions)

#### Priority
- **MEDIUM** - Important for session management but not blocking

#### Effort
- **S** (1 hour)
  - Included in session management epic

---

### User Story: US-006 - Delete Session (/session delete)

**As a** developer cleaning up old sessions
**I want** to delete sessions I no longer need
**So that** I can keep my session list organized and save disk space

#### Acceptance Criteria
- [ ] `/session delete <id>` deletes specific session
- [ ] Confirmation prompt before deletion
- [ ] Success message with deleted session details
- [ ] `/session delete --all` clears all sessions (with strong warning)
- [ ] `/session delete --older-than 30d` deletes sessions older than threshold
- [ ] Cannot delete currently active session

#### Technical Notes
- Implementation file: `src/commands/handlers/session/session.ts`
- Soft delete option: move to `.grok/trash/` with 7-day retention
- Batch delete with progress indicator for many sessions
- Edge case: Handle deletion of session being read by another process

#### Priority
- **LOW** - Nice to have but not critical for MVP

#### Effort
- **S** (1 hour)
  - Included in session management epic

---

### User Story: US-007 - Rename Session (/rename)

**As a** developer organizing my sessions
**I want** to rename sessions with descriptive titles
**So that** I can easily identify them later

#### Acceptance Criteria
- [ ] `/rename <name>` renames current session
- [ ] `/rename` prompts for new name interactively
- [ ] Name validation: 1-100 characters, no path separators
- [ ] Success message confirms rename
- [ ] Name appears in session list and picker

#### Technical Notes
- Implementation file: `src/commands/handlers/session/rename.ts`
- Update session metadata file, not filename
- Support emoji in session names
- Auto-generated names use AI summary of first prompt (optional feature)

#### Priority
- **MEDIUM** - Enhances organization but not blocking

#### Effort
- **S** (1 hour)

---

### User Story: US-008 - Export Conversation (/export)

**As a** developer sharing my AI-assisted work
**I want** to export my conversation to a file
**So that** I can share it with colleagues, archive it, or use it in documentation

#### Acceptance Criteria
- [ ] `/export <filename>` exports conversation
- [ ] Supported formats: `.md` (Markdown), `.json` (structured), `.txt` (plain)
- [ ] Format inferred from extension or specified with `--format`
- [ ] Export includes: messages, timestamps, tool calls with outputs
- [ ] Sensitive data redacted: API keys, passwords, tokens
- [ ] Success message with file path and size

#### Technical Notes
- Implementation file: `src/commands/handlers/session/export.ts`, `src/session/export.ts`
- Markdown format: Human-readable conversation log with code blocks
- JSON format: Full structured data for programmatic use
- Redaction patterns: `/api[_-]?key/i`, `/password/i`, `/token/i`, `/secret/i`
- Edge case: Handle export to read-only directories
- Edge case: Handle very large conversations (>10MB)

#### Priority
- **MEDIUM** - Important for knowledge sharing workflows

#### Effort
- **M** (3 hours)
  - Export format templates: 1.5 hours
  - Redaction logic: 1 hour
  - Command handler and testing: 0.5 hours

---

## Epic 3: Conversation Management

### User Story: US-009 - Clear Conversation (/clear)

**As a** developer starting a new task
**I want** to clear my conversation history
**So that** I can start fresh without accumulated context affecting responses

#### Acceptance Criteria
- [ ] `/clear` prompts for confirmation showing message count
- [ ] After confirmation, conversation history is emptied
- [ ] Session continues (not terminated)
- [ ] GROK.md context is reloaded after clear
- [ ] System message confirms successful clear
- [ ] `/clear --force` skips confirmation

#### Technical Notes
- Implementation file: `src/commands/handlers/core/clear.ts`
- Clear should preserve session metadata (ID, name, creation time)
- Clear should reset token counters
- Edge case: Clear during active streaming (wait for completion)

#### Priority
- **HIGH** - Essential for daily workflow

#### Effort
- **S** (1 hour)

---

### User Story: US-010 - View History (/history)

**As a** developer reviewing my conversation
**I want** to see statistics about my current session
**So that** I can understand the scope of my conversation

#### Acceptance Criteria
- [ ] `/history` displays: message count (user/assistant), tool call count, session duration
- [ ] Shows breakdown by message type
- [ ] Displays session start time and elapsed time
- [ ] Shows model changes within session
- [ ] `/history --full` shows full message list with timestamps

#### Technical Notes
- Implementation file: `src/commands/handlers/core/history.ts`
- Calculate statistics from message array
- Format durations human-readably (e.g., "2h 15m")
- Full history view should paginate for long conversations

#### Priority
- **MEDIUM** - Useful for understanding conversation state

#### Effort
- **S** (1 hour)

---

### User Story: US-011 - Rewind Conversation (/rewind)

**As a** developer who made a wrong turn in my conversation
**I want** to undo the last few exchanges
**So that** I can try a different approach without starting over

#### Acceptance Criteria
- [ ] `/rewind` removes last user+assistant message pair
- [ ] `/rewind <n>` removes last n pairs
- [ ] Confirmation shows messages to be removed
- [ ] Cannot rewind past session start
- [ ] Associated tool calls also removed
- [ ] Success message shows remaining message count

#### Technical Notes
- Implementation file: `src/commands/handlers/session/rewind.ts`
- Store removed messages temporarily for potential redo
- Update token counters after rewind
- Edge case: Rewind during active response (cancel and rewind)

#### Priority
- **MEDIUM** - Helpful for iterative exploration

#### Effort
- **S** (1 hour)

---

### User Story: US-012 - Compact Conversation (/compact)

**As a** developer with a long conversation approaching context limits
**I want** to condense my conversation history
**So that** I can continue without losing important context

#### Acceptance Criteria
- [ ] `/compact` summarizes older messages while preserving recent ones
- [ ] Last 10 messages preserved verbatim
- [ ] Summary captures: key decisions, code changes, established facts
- [ ] Shows context savings: "Reduced from 150K to 45K tokens"
- [ ] Confirmation before compacting
- [ ] `/compact --aggressive` more aggressive summarization

#### Technical Notes
- Implementation file: `src/commands/handlers/core/compact.ts`, `src/lib/compactor.ts`
- Use current model to generate summary
- Preserve tool call results that contain important code
- Summary format: Structured bullet points
- Edge case: Very short conversations (don't compact if <20 messages)

#### Priority
- **MEDIUM** - Important for long conversations but can be deferred

#### Effort
- **L** (5 hours)
  - Summarization logic: 3 hours
  - UI and integration: 2 hours

---

## Epic 4: Help System

### User Story: US-013 - View Help (/help)

**As a** new user learning grok-cli
**I want** to see all available commands with descriptions
**So that** I can discover and learn the CLI capabilities

#### Acceptance Criteria
- [ ] `/help` displays categorized command list
- [ ] Categories: Core, Session, Configuration, Development, Advanced
- [ ] Each command shows: name, aliases, brief description
- [ ] `/help <command>` shows detailed help for specific command
- [ ] Detailed help includes: usage, arguments, examples, related commands
- [ ] Help text is colorized and well-formatted

#### Technical Notes
- Implementation file: `src/commands/handlers/core/help.ts`
- Help text embedded in command definitions
- Support `/?` as alias for `/help`
- Pager for long help output (less-like scrolling)
- Examples should be copy-pasteable

#### Priority
- **HIGH** - Essential for discoverability and onboarding

#### Effort
- **M** (3 hours)
  - Help framework and rendering: 2 hours
  - Help text for all commands: 1 hour

---

### User Story: US-014 - Command Suggestions on Error

**As a** user who made a typo in a command
**I want** to see suggestions for what I might have meant
**So that** I can quickly correct my input

#### Acceptance Criteria
- [ ] Unknown commands show "Did you mean: /xxx?" suggestions
- [ ] Suggestions use Levenshtein distance for similarity
- [ ] Maximum 3 suggestions shown
- [ ] Error message includes `/help` pointer
- [ ] Handles common typos gracefully

#### Technical Notes
- Implementation in command parser/executor
- Use simple edit distance algorithm (no external deps)
- Consider prefix matching for partial commands
- Example: `/mdoel` -> "Did you mean: /model?"

#### Priority
- **MEDIUM** - Good UX improvement

#### Effort
- **S** (1 hour)

---

## Epic 5: Configuration

### User Story: US-015 - View/Set Configuration (/config)

**As a** power user customizing grok-cli
**I want** to view and modify configuration settings
**So that** the tool matches my workflow preferences

#### Acceptance Criteria
- [ ] `/config` shows all current settings in grouped format
- [ ] `/config <key>` shows specific setting value
- [ ] `/config <key> <value>` sets configuration value
- [ ] Settings persist to `.grok/settings.json`
- [ ] Validates values against schema
- [ ] Shows default vs. current value distinction
- [ ] Supports nested keys: `/config output.style markdown`

#### Technical Notes
- Implementation files: `src/commands/handlers/config/config.ts`, `src/config/settings.ts`
- Configuration hierarchy: CLI flags > project config > global config > defaults
- Schema validation using Zod
- Config file created on first set if doesn't exist
- Edge case: Handle concurrent config writes
- Edge case: Handle malformed config files

#### Priority
- **HIGH** - Essential for customization

#### Effort
- **M** (3 hours)
  - Settings manager: 1.5 hours
  - Command handler: 1 hour
  - Schema validation: 0.5 hours

---

### User Story: US-016 - Permission Audit (/permissions)

**As a** security-conscious developer
**I want** to see what permissions grok-cli has used
**So that** I can verify it's only accessing what I expect

#### Acceptance Criteria
- [ ] `/permissions` shows tools used this session
- [ ] Displays: tool name, execution count, last use time
- [ ] Shows paths accessed (Read, Write, Edit)
- [ ] Shows commands executed (Bash)
- [ ] Highlights denied permission requests
- [ ] `/permissions --session` shows current session only
- [ ] `/permissions --all` shows all-time history

#### Technical Notes
- Implementation file: `src/commands/handlers/config/permissions.ts`
- Integrate with existing `PermissionManager`
- Log permission grants/denials to file
- Privacy: Don't log sensitive command content, just metadata
- Edge case: Very long path lists (truncate with count)

#### Priority
- **MEDIUM** - Important for security-conscious users

#### Effort
- **M** (3 hours)
  - Permission logging: 1.5 hours
  - Display formatting: 1 hour
  - Integration: 0.5 hours

---

### User Story: US-017 - Output Style (/output-style)

**As a** user with display preferences
**I want** to change how grok-cli formats output
**So that** it matches my terminal and reading preferences

#### Acceptance Criteria
- [ ] `/output-style` shows current style
- [ ] `/output-style <style>` sets style: `plain`, `markdown`, `json`
- [ ] `plain`: No formatting, raw text
- [ ] `markdown`: Formatted with colors and styling
- [ ] `json`: Structured JSON output for scripting
- [ ] Setting persists across sessions

#### Technical Notes
- Implementation file: `src/commands/handlers/config/output-style.ts`
- Affects: assistant messages, command output, error messages
- JSON mode useful for piping to `jq`
- Plain mode for accessibility or simple terminals

#### Priority
- **LOW** - Nice to have for advanced users

#### Effort
- **S** (1 hour)

---

### User Story: US-018 - System Status (/status)

**As a** user troubleshooting issues
**I want** to see the current system status
**So that** I can verify configuration and diagnose problems

#### Acceptance Criteria
- [ ] `/status` shows comprehensive system information
- [ ] Displays: version, current model, session info, context usage
- [ ] Shows: config file locations (project/global)
- [ ] Shows: API connection status
- [ ] Shows: tool availability (ripgrep, etc.)
- [ ] Indicates any warnings or issues

#### Technical Notes
- Implementation file: `src/commands/handlers/config/status.ts`
- Check API connectivity with lightweight ping
- Verify tool dependencies exist in PATH
- Show memory usage and uptime
- Include debug info useful for bug reports

#### Priority
- **MEDIUM** - Helpful for troubleshooting

#### Effort
- **S** (1 hour)

---

## Epic 6: Usage Tracking

### User Story: US-019 - View Token Usage and Costs (/cost)

**As a** developer monitoring my API costs
**I want** to see my token usage and estimated costs
**So that** I can budget and optimize my usage

#### Acceptance Criteria
- [ ] `/cost` shows session token usage: input, output, total
- [ ] Shows cost calculation based on model pricing
- [ ] Displays breakdown by model if multiple used
- [ ] Shows cumulative usage (session + historical)
- [ ] Warning when approaching budget limits (if configured)
- [ ] `/cost --session` current session only
- [ ] `/cost --today` today's usage

#### Technical Notes
- Implementation files: `src/commands/handlers/core/cost.ts`, `src/lib/usage-tracker.ts`
- Token counts from API response metadata
- Pricing data in `src/config/models.ts`
- Store usage history in `.grok/usage.json`
- Format costs with appropriate precision ($0.0012)

#### Priority
- **HIGH** - Critical for cost management

#### Effort
- **M** (3 hours)
  - Usage tracking infrastructure: 2 hours
  - Command handler and display: 1 hour

---

### User Story: US-020 - View Context Usage (/context)

**As a** developer working with large codebases
**I want** to see my context window usage
**So that** I can avoid hitting limits and plan accordingly

#### Acceptance Criteria
- [ ] `/context` shows: tokens used, tokens available, percentage
- [ ] Visual progress bar representation
- [ ] Breakdown: system prompt, GROK.md, conversation, tool results
- [ ] Warning indicator at 80% usage
- [ ] Shows current model's context limit
- [ ] Suggests `/compact` when approaching limit

#### Technical Notes
- Implementation files: `src/commands/handlers/core/context.ts`, `src/lib/context-tracker.ts`
- Use tiktoken or similar for accurate token counting
- Cache token counts for performance
- Update counts after each message
- Different models have different context limits

#### Priority
- **HIGH** - Essential for large codebase work

#### Effort
- **M** (3 hours)
  - Token counting implementation: 1.5 hours
  - Context breakdown calculation: 1 hour
  - Display and UI: 0.5 hours

---

## Epic 7: Development Tools

### User Story: US-021 - Code Review Mode (/review)

**As a** developer wanting code review assistance
**I want** to enter a dedicated review mode
**So that** I can get focused feedback on my code changes

#### Acceptance Criteria
- [ ] `/review` starts review mode for staged changes
- [ ] `/review <file>` reviews specific file
- [ ] `/review --diff` reviews current git diff
- [ ] Review provides: summary, issues, suggestions, security concerns
- [ ] Structured output with severity levels
- [ ] Exit review mode with `/done` or empty input

#### Technical Notes
- Implementation file: `src/commands/handlers/dev/review.ts`
- Uses git diff for change detection
- Pre-configured prompt for thorough code review
- Could integrate with existing Read tool for file access
- Consider streaming for large diffs

#### Priority
- **MEDIUM** - Useful development workflow feature

#### Effort
- **M** (3 hours)

---

### User Story: US-022 - Memory Management (/memory)

**As a** developer customizing AI context
**I want** to view and edit GROK.md files
**So that** I can maintain project-specific instructions

#### Acceptance Criteria
- [ ] `/memory` shows current GROK.md contents
- [ ] `/memory show` displays all loaded context files
- [ ] `/memory edit` opens GROK.md in default editor
- [ ] `/memory add <content>` appends to GROK.md
- [ ] `/memory reload` reloads context without restart
- [ ] Shows which files are loaded (project, global)

#### Technical Notes
- Implementation file: `src/commands/handlers/dev/memory.ts`
- Integrate with existing `ContextLoader`
- Editor detection: $EDITOR, $VISUAL, or fallback
- Support both `.grok/GROK.md` and root `GROK.md`
- Edge case: GROK.md doesn't exist (create template)

#### Priority
- **MEDIUM** - Enhances context customization

#### Effort
- **M** (3 hours)

---

### User Story: US-023 - Initialize Project (/init)

**As a** developer starting with grok-cli in a new project
**I want** to initialize the .grok directory structure
**So that** I can have proper project-specific configuration

#### Acceptance Criteria
- [ ] `/init` creates `.grok/` directory structure
- [ ] Creates: `settings.json` (defaults), `GROK.md` (template), `sessions/`
- [ ] Does not overwrite existing files
- [ ] Shows what was created
- [ ] Adds `.grok/sessions/` to `.gitignore` suggestion
- [ ] `/init --force` overwrites existing

#### Technical Notes
- Implementation file: `src/commands/handlers/dev/init.ts`
- Template GROK.md with project structure hints
- Detect project type (Node, Python, etc.) for tailored template
- Interactive mode for customization options

#### Priority
- **LOW** - Helpful but manual setup works

#### Effort
- **S** (1 hour)

---

### User Story: US-024 - View TODOs (/todos)

**As a** developer tracking AI-generated tasks
**I want** to see the current TODO list from the Todo tool
**So that** I can track progress on multi-step tasks

#### Acceptance Criteria
- [ ] `/todos` displays current todo list
- [ ] Shows: task description, status (pending/in_progress/completed)
- [ ] Visual indicators for status
- [ ] `/todos clear` clears completed todos
- [ ] Empty state message when no todos

#### Technical Notes
- Implementation file: `src/commands/handlers/dev/todos.ts`
- Integrate with existing `Todo` tool state
- Read from todo state in agent context
- Consider persistence of todos across sessions

#### Priority
- **LOW** - Todo tool already shows state

#### Effort
- **S** (1 hour)

---

## Epic 8: CLI Flag Parsing

### User Story: US-025 - Model Flag (--model)

**As a** developer starting a session
**I want** to specify the model at launch
**So that** I can use the appropriate model from the start

#### Acceptance Criteria
- [ ] `grok --model grok-4 "prompt"` starts with grok-4
- [ ] `grok -m fast "prompt"` uses alias
- [ ] Model persists for entire session
- [ ] Invalid model shows error with available options
- [ ] Works with both interactive and prompt modes

#### Technical Notes
- Implementation file: `src/config/cli-args.ts`
- Parser: commander.js or yargs
- Integrate with model resolution in `src/config/models.ts`
- Already partially implemented, needs enhancement

#### Priority
- **HIGH** - Core CLI functionality

#### Effort
- **S** (1 hour) - Enhancement of existing

---

### User Story: US-026 - Resume Flag (--resume)

**As a** developer continuing work
**I want** to resume my last session at launch
**So that** I can get back to work immediately without interactive selection

#### Acceptance Criteria
- [ ] `grok --resume` continues last session
- [ ] `grok --resume <id>` continues specific session
- [ ] `grok -r` short alias works
- [ ] Error if no sessions exist
- [ ] Shows session info on resume

#### Technical Notes
- Implementation file: `src/config/cli-args.ts`
- Integrate with session manager
- Load session before UI render
- Edge case: Corrupted last session (fallback to list)

#### Priority
- **HIGH** - Key workflow efficiency feature

#### Effort
- **S** (1 hour)

---

### User Story: US-027 - Permission Flags (--yolo, --plan)

**As a** developer with different trust levels for tasks
**I want** to control permission behavior at launch
**So that** I can work efficiently or safely as needed

#### Acceptance Criteria
- [ ] `grok --yolo` / `grok -y` approves all tool operations
- [ ] `grok --plan` enables read-only mode (no writes/executions)
- [ ] `grok --allowed-tools Read,Glob` pre-approves specific tools
- [ ] `grok --denied-tools Bash` blocks specific tools
- [ ] Permission mode shown in status

#### Technical Notes
- Implementation file: `src/config/cli-args.ts`
- Integrate with `PermissionManager`
- --yolo is dangerous, show warning on startup
- --plan useful for exploration without risk
- Tool names case-insensitive

#### Priority
- **MEDIUM** - Power user feature

#### Effort
- **M** (3 hours)

---

### User Story: US-028 - Output Flags (--quiet, --json)

**As a** developer automating tasks
**I want** to control output format
**So that** I can use grok-cli in scripts

#### Acceptance Criteria
- [ ] `grok --quiet` / `grok -q` suppresses UI chrome
- [ ] `grok --json` outputs structured JSON
- [ ] `grok --no-color` disables color output
- [ ] `grok --no-stream` waits for complete response
- [ ] `grok -p "prompt"` prints response and exits
- [ ] Exit codes: 0 success, 1 error

#### Technical Notes
- Implementation file: `src/config/cli-args.ts`
- JSON mode useful for piping to jq
- Quiet mode still shows errors
- Non-interactive mode for CI/CD integration

#### Priority
- **MEDIUM** - Important for scripting

#### Effort
- **M** (3 hours)

---

### User Story: US-029 - Help and Version Flags

**As a** user learning grok-cli
**I want** to see help and version information from command line
**So that** I can understand usage and verify installation

#### Acceptance Criteria
- [ ] `grok --help` / `grok -h` shows comprehensive help
- [ ] `grok --version` / `grok -V` shows version number
- [ ] Help shows: usage, flags, examples, environment variables
- [ ] Version shows: version, build info, Node.js version

#### Technical Notes
- Implementation file: `src/config/cli-args.ts`
- Version from package.json
- Help text maintained alongside flag definitions
- Examples should be practical and copy-pasteable

#### Priority
- **HIGH** - Essential CLI convention

#### Effort
- **S** (1 hour)

---

## Epic 9: Backwards Compatibility

### User Story: US-030 - Preserve Existing Chat Flow

**As an** existing grok-cli user
**I want** my current workflow to continue working unchanged
**So that** I don't have to relearn the tool

#### Acceptance Criteria
- [ ] Regular prompts (not starting with /) work exactly as before
- [ ] `exit` and `quit` text commands still work
- [ ] Tool execution behavior unchanged
- [ ] GROK.md loading unchanged
- [ ] Permission prompts unchanged
- [ ] Default model remains grok-4-1-fast
- [ ] No new required configuration

#### Technical Notes
- Command parser only intercepts `/` prefixed input
- All existing tests must pass
- No changes to tool interfaces
- No changes to agent behavior
- Regression test suite required

#### Priority
- **HIGH** - Critical for user trust and adoption

#### Effort
- **M** (3 hours) - Testing and verification

---

### User Story: US-031 - Graceful Command Errors

**As a** user accidentally using command syntax
**I want** errors to be helpful, not disruptive
**So that** I can quickly recover from mistakes

#### Acceptance Criteria
- [ ] Unknown `/xxx` commands show helpful error, not crash
- [ ] Malformed commands show usage hint
- [ ] Errors don't clear conversation history
- [ ] Can immediately retry after error
- [ ] Error messages include command reference

#### Technical Notes
- Implementation in command executor
- Errors displayed as system messages in conversation
- Error state doesn't affect next prompt
- Log errors for debugging without exposing to user

#### Priority
- **HIGH** - Essential for robust UX

#### Effort
- **S** (1 hour)

---

## Summary: Priority and Effort Matrix

### Priority: HIGH (Must Have)

| Story | Title | Effort |
|-------|-------|--------|
| US-001 | Model Switching | M (3h) |
| US-002 | View Available Models | S (1h) |
| US-003 | Save Session | L (5h) |
| US-004 | Resume Session | M (3h) |
| US-009 | Clear Conversation | S (1h) |
| US-013 | View Help | M (3h) |
| US-015 | View/Set Configuration | M (3h) |
| US-019 | View Token Costs | M (3h) |
| US-020 | View Context Usage | M (3h) |
| US-025 | Model Flag | S (1h) |
| US-026 | Resume Flag | S (1h) |
| US-029 | Help/Version Flags | S (1h) |
| US-030 | Backwards Compatibility | M (3h) |
| US-031 | Graceful Errors | S (1h) |

**Total HIGH Priority:** 32 hours

### Priority: MEDIUM (Should Have)

| Story | Title | Effort |
|-------|-------|--------|
| US-005 | List Sessions | S (1h) |
| US-007 | Rename Session | S (1h) |
| US-008 | Export Conversation | M (3h) |
| US-010 | View History | S (1h) |
| US-011 | Rewind Conversation | S (1h) |
| US-012 | Compact Conversation | L (5h) |
| US-014 | Command Suggestions | S (1h) |
| US-016 | Permission Audit | M (3h) |
| US-018 | System Status | S (1h) |
| US-021 | Code Review Mode | M (3h) |
| US-022 | Memory Management | M (3h) |
| US-027 | Permission Flags | M (3h) |
| US-028 | Output Flags | M (3h) |

**Total MEDIUM Priority:** 29 hours

### Priority: LOW (Nice to Have)

| Story | Title | Effort |
|-------|-------|--------|
| US-006 | Delete Session | S (1h) |
| US-017 | Output Style | S (1h) |
| US-023 | Initialize Project | S (1h) |
| US-024 | View TODOs | S (1h) |

**Total LOW Priority:** 4 hours

---

## Implementation Phases

### Phase 2.1: Essential Commands (Week 1)
- US-001, US-002: Model Management
- US-009: Clear Conversation
- US-013, US-014: Help System
- US-029: Help/Version Flags
- US-030, US-031: Backwards Compatibility
- **Estimated Effort:** 14 hours

### Phase 2.2: Session Management (Week 2)
- US-003, US-004, US-005, US-006, US-007, US-008: Session Epic
- US-026: Resume Flag
- **Estimated Effort:** 15 hours

### Phase 2.3: Configuration & Tracking (Week 3)
- US-015, US-016, US-017, US-018: Configuration
- US-019, US-020: Usage Tracking
- US-025, US-027, US-028: CLI Flags
- **Estimated Effort:** 20 hours

### Phase 2.4: Development Tools (Week 4)
- US-010, US-011, US-012: Conversation Management
- US-021, US-022, US-023, US-024: Development Tools
- **Estimated Effort:** 16 hours

---

**Total Estimated Effort:** 65 hours

**Document End**

*User Stories prepared for grok-cli development team.*
