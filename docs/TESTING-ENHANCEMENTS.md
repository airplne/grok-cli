# Testing Enhancements for Command System

**Purpose:** Supplement PRP verification checklists with concrete test examples

---

## End-to-End Test Examples

### E2E Test 1: Command + Tool Interaction

**Scenario:** Verify commands work correctly with tool execution

```typescript
// tests/e2e/command-tool-interaction.test.ts

describe('Command and Tool Interaction', () => {
  it('should allow /clear after file operations', async () => {
    // Start CLI
    const session = await startGrokCLI();

    // Execute file read (uses Read tool)
    await session.send('Read the package.json file');
    expect(await session.waitForOutput()).toContain('grok-cli');

    // Clear conversation
    await session.send('/clear');
    expect(await session.getMessages()).toHaveLength(0);

    // Verify agent still works
    await session.send('Hello');
    expect(await session.waitForOutput()).toContain('Hello');
  });

  it('should preserve model across /clear', async () => {
    const session = await startGrokCLI();

    // Switch model
    await session.send('/model grok-4');
    expect(await session.getCurrentModel()).toBe('grok-4');

    // Clear and verify model persists
    await session.send('/clear');
    expect(await session.getCurrentModel()).toBe('grok-4');
  });

  it('should handle /model during tool execution', async () => {
    const session = await startGrokCLI();

    // Start long-running tool
    session.send('Find all files matching **/*.ts');

    // Try to switch model while tool is running
    const result = await session.send('/model grok-4');

    // Expected: Either queued or rejected with error
    expect(result).toMatch(/model will switch after|cannot switch during/);
  });
});
```

---

### E2E Test 2: Session Persistence with Tools

**Scenario:** Verify tool outputs are saved/restored in sessions

```typescript
// tests/e2e/session-persistence.test.ts

describe('Session Persistence', () => {
  it('should save and restore tool outputs', async () => {
    const session = await startGrokCLI();

    // Execute tool
    await session.send('Read the package.json');
    const toolOutput = await session.waitForToolOutput('Read');

    // Save session
    await session.send('/session save test-with-tools');
    const sessionId = await session.getLastSavedSessionId();

    // Exit and resume
    await session.exit();
    const newSession = await resumeGrokCLI(sessionId);

    // Verify tool output is restored
    const messages = await newSession.getMessages();
    const hasToolOutput = messages.some(m =>
      m.role === 'assistant' && m.content.includes('package.json')
    );
    expect(hasToolOutput).toBe(true);
  });

  it('should handle session resume with model mismatch', async () => {
    // Create session with grok-4
    const s1 = await startGrokCLI({ model: 'grok-4' });
    await s1.send('Test message');
    await s1.send('/session save model-test');
    await s1.exit();

    // Resume with different model
    const s2 = await startGrokCLI({ model: 'grok-4-1-fast' });
    await s2.send('/resume model-test');

    // Expected: Either switches to saved model or warns about mismatch
    const model = await s2.getCurrentModel();
    expect(model).toBe('grok-4');  // Should match saved session
  });
});
```

---

### E2E Test 3: Multi-Turn Conversation with Commands

**Scenario:** Real-world usage pattern

```typescript
describe('Multi-Turn Workflow', () => {
  it('should handle realistic development session', async () => {
    const session = await startGrokCLI();

    // Turn 1: Get help
    await session.send('/help');
    expect(await session.waitForOutput()).toContain('/model');

    // Turn 2: Check current model
    await session.send('/model');
    expect(await session.waitForOutput()).toContain('grok-4-1-fast');

    // Turn 3: Code question
    await session.send('Explain this function');
    expect(await session.waitForOutput()).toContain('function');

    // Turn 4: Use tool
    await session.send('Read the README.md');
    await session.waitForToolOutput('Read');

    // Turn 5: Check history
    await session.send('/history');
    const output = await session.waitForOutput();
    expect(output).toContain('5 messages');

    // Turn 6: Save session
    await session.send('/session save dev-workflow');
    expect(await session.waitForOutput()).toContain('saved');

    // Verify all messages persisted
    expect(await session.getMessages()).toHaveLength(11);  // 5 user + 5 assistant + 1 system
  });
});
```

---

## Jest Test Stubs for Command Handlers

### Model Command Tests

```typescript
// tests/unit/commands/handlers/model.test.ts

import { describe, it, expect } from 'vitest';
import { ModelCommand } from '../../../../src/commands/handlers/model.js';
import { mockCommandContext } from '../../../helpers/mock-context.js';

describe('ModelCommand', () => {
  const cmd = new ModelCommand();

  it('should show current model when no args', () => {
    const ctx = mockCommandContext({ currentModel: 'grok-4-1-fast' });
    const result = cmd.execute([], ctx);

    expect(result.type).toBe('success');
    expect(result.message).toContain('grok-4-1-fast');
    expect(result.preventAgentRun).toBe(true);
  });

  it('should switch to valid model', () => {
    const ctx = mockCommandContext();
    const result = cmd.execute(['grok-4'], ctx);

    expect(result.type).toBe('success');
    expect(ctx.setModel).toHaveBeenCalledWith('grok-4');
  });

  it('should reject invalid model', () => {
    const ctx = mockCommandContext();
    const result = cmd.execute(['invalid-model'], ctx);

    expect(result.type).toBe('error');
    expect(result.message).toContain('Unknown model');
  });

  it('should handle model aliases', () => {
    const ctx = mockCommandContext();
    const result = cmd.execute(['fast'], ctx);

    expect(ctx.setModel).toHaveBeenCalledWith('grok-4-1-fast');
  });
});
```

### Parser Tests

```typescript
// tests/unit/commands/parser.test.ts

import { describe, it, expect } from 'vitest';
import { parseCommand, isCommand } from '../../../src/commands/parser.js';

describe('Command Parser', () => {
  describe('isCommand', () => {
    it('should detect slash commands', () => {
      expect(isCommand('/help')).toBe(true);
      expect(isCommand('  /model  ')).toBe(true);
    });

    it('should reject non-commands', () => {
      expect(isCommand('hello')).toBe(false);
      expect(isCommand('/')).toBe(false);
    });
  });

  describe('parseCommand', () => {
    it('should parse simple commands', () => {
      const result = parseCommand('/help');
      expect(result).toEqual({
        name: 'help',
        args: [],
        rawArgs: ''
      });
    });

    it('should parse commands with arguments', () => {
      const result = parseCommand('/model grok-4');
      expect(result).toEqual({
        name: 'model',
        args: ['grok-4'],
        rawArgs: 'grok-4'
      });
    });

    it('should handle quoted arguments', () => {
      const result = parseCommand('/session save "my session name"');
      expect(result.args).toEqual(['save', 'my session name']);
    });

    it('should handle flags', () => {
      const result = parseCommand('/export --format markdown --output test.md');
      expect(result.args).toContain('--format');
      expect(result.args).toContain('markdown');
    });
  });
});
```

### Session Manager Tests

```typescript
// tests/unit/session/manager.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../../src/session/manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('SessionManager', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grok-test-'));
    process.env.HOME = testDir;
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create and save session', async () => {
    const session = await SessionManager.create({
      model: 'grok-4-1-fast',
      messages: [{ role: 'user', content: 'test' }],
      cwd: process.cwd()
    });

    expect(session.id).toBeDefined();
    expect(session.model).toBe('grok-4-1-fast');
  });

  it('should load saved session', async () => {
    const created = await SessionManager.create({
      model: 'grok-4',
      messages: [{ role: 'user', content: 'test' }],
      cwd: process.cwd()
    });

    const loaded = await SessionManager.load(created.id);
    expect(loaded.id).toBe(created.id);
    expect(loaded.messages).toHaveLength(1);
  });

  it('should list sessions sorted by date', async () => {
    await SessionManager.create({ model: 'grok-4', messages: [], cwd: '/' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await SessionManager.create({ model: 'grok-4-1-fast', messages: [], cwd: '/' });

    const list = await SessionManager.list();
    expect(list[0].model).toBe('grok-4-1-fast');  // Most recent first
  });

  it('should delete sessions', async () => {
    const session = await SessionManager.create({ model: 'grok-4', messages: [], cwd: '/' });
    await SessionManager.delete(session.id);

    await expect(SessionManager.load(session.id)).rejects.toThrow();
  });
});
```

---

## Mock Helpers

```typescript
// tests/helpers/mock-context.ts

import { CommandContext } from '../../src/commands/types.js';
import { vi } from 'vitest';

export function mockCommandContext(overrides?: Partial<CommandContext>): CommandContext {
  return {
    currentModel: 'grok-4-1-fast',
    messages: [],
    setModel: vi.fn(),
    clearMessages: vi.fn(),
    addSystemMessage: vi.fn(),
    exit: vi.fn(),
    ...overrides
  };
}
```

---

## Coverage Goals

| Phase | Target Coverage | Files |
|-------|----------------|-------|
| Phase 1 | 80%+ | commands/, config/models.ts |
| Phase 2 | 85%+ | session/, command handlers |
| Phase 3 | 90%+ | All modules |

---

## Integration with CI/CD

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:e2e": "vitest run tests/e2e",
    "test:security": "bash tests/security/test-session-security.sh",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

**Use these testing enhancements alongside the PRP verification checklists for comprehensive quality assurance.**
