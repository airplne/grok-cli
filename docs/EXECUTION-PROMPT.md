# EXECUTION PROMPT: Build grok-cli Phase 1

**For:** Claude Dev Team
**Priority:** ULTRATHINK Execution
**Source of Truth:** `/home/aip0rt/Desktop/grok-cli/docs/prp-claude-build-grok-cli.md`

---

## DIRECTIVE

You are executing Phase 1 of the grok-cli PRP. This builds a fully standalone Claude Code clone for the xAI Grok API with an anti-flickering Ink terminal UI.

**Read the PRP first. Execute it exactly. Do not improvise.**

---

## CRITICAL CONSTRAINTS

### MUST DO
- [ ] Read each PRP step completely before implementing
- [ ] Create files in the EXACT paths specified
- [ ] Copy code EXACTLY as written in PRP (including comments)
- [ ] Use the anti-flickering patterns (text buffering, Static component, React.memo)
- [ ] Test after each major step before proceeding
- [ ] Use TodoWrite to track progress through steps

### MUST NOT
- [ ] Do NOT add features not in the PRP
- [ ] Do NOT "improve" the code beyond what's specified
- [ ] Do NOT use commander - we use Ink for the UI
- [ ] Do NOT skip the security layer (path-validator, command-allowlist)
- [ ] Do NOT use array indices as React keys - use generated IDs
- [ ] Do NOT import from automaker or any external codebase

---

## EXECUTION SEQUENCE

### Phase 1A: Project Foundation (Steps 1.1-1.3)

```bash
# 1. Verify working directory
cd /home/aip0rt/Desktop/grok-cli

# 2. Create src directory structure
mkdir -p src/{agent,client,tools,mcp,hooks,session,context,security,ui/components,ui/hooks,config,lib}
mkdir -p tests/{unit,e2e}

# 3. Create package.json (from PRP Step 1.1)
# 4. Create tsconfig.json (from PRP Step 1.1)
# 5. Install dependencies
npm install

# 6. Create GrokClient (from PRP Step 1.2)
# 7. Create BaseTool (from PRP Step 1.3)
```

**Verification:** `npm run dev` should fail with "Cannot find module" (expected - no index.ts yet)

---

### Phase 1B: Core Tools (Step 1.4)

Create ALL 7 tools in this order:
1. `src/tools/read.ts`
2. `src/tools/write.ts`
3. `src/tools/edit.ts`
4. `src/tools/bash.ts`
5. `src/tools/glob.ts`
6. `src/tools/grep.ts`
7. `src/tools/todo.ts` ← Don't forget this one!
8. `src/tools/index.ts` (exports all tools)

**Verification:** TypeScript should compile without errors: `npx tsc --noEmit`

---

### Phase 1C: Security Layer (Step 1.5)

Create in order:
1. `src/security/path-validator.ts`
2. `src/security/command-allowlist.ts`
3. `src/security/permission-manager.ts`

**Critical:** The permission-manager exports `ConfirmationHandler` type for Ink integration.

---

### Phase 1D: Utilities (Step 1.6)

Create:
1. `src/lib/errors.ts` - GrokError, APIError, ToolError, SecurityError, ConfigError
2. `src/lib/logger.ts` - Logger class with file output

---

### Phase 1E: Context & Agent (Steps 1.7-1.8)

Create:
1. `src/context/context-loader.ts` - GROK.md loading with @import support
2. `src/agent/grok-agent.ts` - Agent loop with confirmation callback

**Critical:** The agent's `run()` method accepts `onConfirmation?: ConfirmationHandler`

---

### Phase 1F: Ink UI (Steps 1.9-1.10)

**This is the anti-flickering implementation. Follow EXACTLY.**

Create entry point:
1. `src/index.tsx` (note: .tsx not .ts)

Create UI components (ALL must use React.memo where specified):
1. `src/ui/app.tsx` - Main app with text buffering (50ms)
2. `src/ui/components/message.tsx` - MessageDisplay (memoized)
3. `src/ui/components/tool-output.tsx` - ToolOutput (memoized)
4. `src/ui/components/spinner.tsx` - Spinner
5. `src/ui/components/confirm.tsx` - ConfirmDialog
6. `src/ui/components/input.tsx` - InputPrompt
7. `src/ui/components/todo-display.tsx` - TodoDisplay (memoized)

**Anti-Flickering Checklist:**
- [ ] Text buffering with 50ms flush timer
- [ ] `Static` component for completed messages
- [ ] `Static` component for completed tool outputs
- [ ] `useMemo` for completedMessages, completedTools, pendingTools
- [ ] `useCallback` for all handlers
- [ ] Generated IDs (not array indices) for keys

---

## FILE CREATION ORDER (Complete List)

Execute in this exact order:

```
1.  package.json
2.  tsconfig.json
3.  src/client/grok-client.ts
4.  src/tools/base-tool.ts
5.  src/tools/read.ts
6.  src/tools/write.ts
7.  src/tools/edit.ts
8.  src/tools/bash.ts
9.  src/tools/glob.ts
10. src/tools/grep.ts
11. src/tools/todo.ts
12. src/tools/index.ts
13. src/security/path-validator.ts
14. src/security/command-allowlist.ts
15. src/security/permission-manager.ts
16. src/lib/errors.ts
17. src/lib/logger.ts
18. src/context/context-loader.ts
19. src/agent/grok-agent.ts
20. src/index.tsx
21. src/ui/app.tsx
22. src/ui/components/message.tsx
23. src/ui/components/tool-output.tsx
24. src/ui/components/spinner.tsx
25. src/ui/components/confirm.tsx
26. src/ui/components/input.tsx
27. src/ui/components/todo-display.tsx
28. GROK.md (example context file)
```

---

## VERIFICATION CHECKLIST

After completing all files, verify:

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Dev mode starts
npm run dev

# 3. Basic conversation (no tools)
npm run dev "Hello, what can you do?"

# 4. Read tool (auto-approved)
npm run dev "Read the package.json file"

# 5. Glob tool (auto-approved)
npm run dev "Find all TypeScript files"

# 6. Write tool (should prompt for confirmation)
npm run dev "Create a file called test.txt with hello world"

# 7. Bash tool (should prompt for confirmation)
npm run dev "Run: echo hello"

# 8. Security - path traversal blocked
npm run dev "Read /etc/passwd"
# Should fail with security error

# 9. Security - dangerous command blocked
npm run dev "Run: rm -rf /"
# Should fail with security error

# 10. No flickering during streaming
# Watch the terminal - text should appear smoothly, not character-by-character
```

---

## ERROR RECOVERY

### "Cannot find module" errors
```bash
# Check tsconfig.json moduleResolution is "NodeNext"
# Ensure all imports use .js extension (not .ts)
```

### "JSX element type does not have construct signatures"
```bash
# Ensure tsconfig.json has "jsx": "react-jsx"
# Ensure React is imported in .tsx files
```

### "GROK_API_KEY not set"
```bash
export GROK_API_KEY="xai-your-key-here"
# Or
export XAI_API_KEY="xai-your-key-here"
```

### Flickering still occurs
- Verify text buffering is implemented (50ms timer)
- Verify Static component wraps completed content
- Verify React.memo on child components
- Check for array index keys (should use generateId())

---

## SUCCESS CRITERIA

Phase 1 is complete when:

1. **Functional**
   - [ ] `npm run dev "prompt"` works end-to-end
   - [ ] All 7 tools execute correctly
   - [ ] Confirmation dialogs appear for Write/Edit/Bash
   - [ ] Read/Glob/Grep/TodoWrite auto-approve

2. **Secure**
   - [ ] Path traversal attempts blocked
   - [ ] Dangerous commands blocked
   - [ ] No secrets/credentials accessible

3. **UI Quality**
   - [ ] No flickering during streaming
   - [ ] Clean terminal output
   - [ ] Responsive input handling
   - [ ] Ctrl+C exits cleanly

4. **Code Quality**
   - [ ] TypeScript compiles with no errors
   - [ ] No runtime crashes
   - [ ] Matches PRP exactly

---

## FINAL NOTES

- **DO NOT** proceed to Phase 2 until Phase 1 verification passes
- **DO NOT** add "improvements" - stick to the PRP
- **DO** use TodoWrite to track your progress
- **DO** test incrementally after each major step
- **DO** report any PRP ambiguities before improvising

**The PRP is your bible. Execute it faithfully.**

---

*Generated by Claude Opus 4.5 with ULTRATHINK*
