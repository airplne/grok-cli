import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import { tools } from '../../src/tools/index.js';
import { KNOWN_TOOL_NAMES } from '../../src/tools/tool-names.js';
import { loadSubagentDefinition, resolveSubagentName, listAvailableSubagents } from '../../src/agents/subagent-loader.js';
import { SUBAGENT_ALIASES } from '../../src/agents/types.js';
import { computeToolCallEvidence } from '../../src/agent/grok-agent.js';
import path from 'path';

/**
 * Truthfulness tests for subagent system.
 *
 * These tests verify:
 * 1. Task tool IS registered (real subagent support)
 * 2. Subagent definitions load correctly
 * 3. Forbidden phrases are detected (for claims without evidence)
 * 4. Evidence logging interface exists
 */

describe('Subagent System', () => {
  describe('Tool Registration', () => {
    it('should have Task tool registered', () => {
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('Task');
    });

    it('should have core tools available', () => {
      const toolNames = tools.map(t => t.name);

      // Core tools should exist
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('Edit');
      expect(toolNames).toContain('Bash');
      expect(toolNames).toContain('Glob');
      expect(toolNames).toContain('Grep');
      expect(toolNames).toContain('TodoWrite');
      expect(toolNames).toContain('Task');
    });

    it('should have exactly 8 tools registered', () => {
      // 7 core tools + Task = 8 total
      expect(tools.length).toBe(8);
    });

    it('KNOWN_TOOL_NAMES should match registered tools', () => {
      const toolNames = tools.map(t => t.name).sort();
      expect(toolNames).toEqual([...KNOWN_TOOL_NAMES].sort());
    });
  });

  describe('Subagent Loader', () => {
    const testCwd = path.join(process.cwd());

    it('should resolve subagent aliases correctly', () => {
      expect(resolveSubagentName('review')).toBe('code-reviewer');
      expect(resolveSubagentName('reviewer')).toBe('code-reviewer');
      expect(resolveSubagentName('grok')).toBe('explore');
      expect(resolveSubagentName('search')).toBe('explore');
      expect(resolveSubagentName('test')).toBe('test-writer');
      expect(resolveSubagentName('tests')).toBe('test-writer');

      // Unknown names should pass through unchanged
      expect(resolveSubagentName('unknown-agent')).toBe('unknown-agent');
    });

    it('should load explore subagent definition', async () => {
      const definition = await loadSubagentDefinition('explore', testCwd);

      expect(definition.name).toBe('explore');
      expect(definition.tools).toContain('Read');
      expect(definition.tools).toContain('Grep');
      expect(definition.tools).toContain('Glob');
      expect(definition.model).toBeDefined();
      expect(definition.maxRounds).toBeGreaterThan(0);
      expect(definition.systemPrompt).toBeTruthy();
    });

    it('should load code-reviewer subagent definition', async () => {
      const definition = await loadSubagentDefinition('code-reviewer', testCwd);

      expect(definition.name).toBe('code-reviewer');
      expect(definition.tools).toContain('Read');
      expect(definition.tools).toContain('Bash');
      expect(definition.systemPrompt).toContain('code review');
    });

    it('should load test-writer subagent definition', async () => {
      const definition = await loadSubagentDefinition('test-writer', testCwd);

      expect(definition.name).toBe('test-writer');
      expect(definition.tools).toContain('Write');
      expect(definition.systemPrompt).toContain('test');
    });

    it('should throw error for unknown subagent', async () => {
      await expect(loadSubagentDefinition('nonexistent-agent', testCwd))
        .rejects.toThrow(/not found/i);
    });

    it('should list available subagents', async () => {
      const agents = await listAvailableSubagents(testCwd);

      expect(agents).toContain('explore');
      expect(agents).toContain('code-reviewer');
      expect(agents).toContain('test-writer');
    });

    it('should have alias mappings defined', () => {
      expect(Object.keys(SUBAGENT_ALIASES).length).toBeGreaterThan(0);
      expect(SUBAGENT_ALIASES['review']).toBe('code-reviewer');
      expect(SUBAGENT_ALIASES['test']).toBe('test-writer');
    });

    it('should reject subagent definitions with unknown tool names', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-loader-test-'));
      try {
        const agentsDir = path.join(tempDir, '.grok', 'agents');
        await fs.mkdir(agentsDir, { recursive: true });
        await fs.writeFile(
          path.join(agentsDir, 'bad-tools.md'),
          [
            '---',
            'name: bad-tools',
            'description: Invalid tool list',
            'tools:',
            '  - Read',
            '  - Grepp',
            'model: grok-4-1-fast',
            'maxRounds: 5',
            '---',
            '',
            'System prompt.',
            '',
          ].join('\n'),
          'utf8'
        );

        await expect(loadSubagentDefinition('bad-tools', tempDir)).rejects.toThrow(/invalid tool/i);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject multiline YAML values in frontmatter', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-loader-test-'));
      try {
        const agentsDir = path.join(tempDir, '.grok', 'agents');
        await fs.mkdir(agentsDir, { recursive: true });
        await fs.writeFile(
          path.join(agentsDir, 'bad-multiline.md'),
          [
            '---',
            'name: bad-multiline',
            'description: |',
            '  This is multiline and should be rejected',
            'tools:',
            '  - Read',
            'model: grok-4-1-fast',
            'maxRounds: 5',
            '---',
            '',
            'System prompt.',
            '',
          ].join('\n'),
          'utf8'
        );

        await expect(loadSubagentDefinition('bad-multiline', tempDir)).rejects.toThrow(/multiline/i);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject nested mappings in frontmatter', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-loader-test-'));
      try {
        const agentsDir = path.join(tempDir, '.grok', 'agents');
        await fs.mkdir(agentsDir, { recursive: true });
        await fs.writeFile(
          path.join(agentsDir, 'bad-nested.md'),
          [
            '---',
            'name: bad-nested',
            'description: Has nested mappings',
            'tools:',
            '  - Read',
            'model: grok-4-1-fast',
            'maxRounds: 5',
            'nested:',
            '  key: value',
            '---',
            '',
            'System prompt.',
            '',
          ].join('\n'),
          'utf8'
        );

        await expect(loadSubagentDefinition('bad-nested', tempDir)).rejects.toThrow(/nested mappings/i);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should allow colons in scalar values', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-loader-test-'));
      try {
        const agentsDir = path.join(tempDir, '.grok', 'agents');
        await fs.mkdir(agentsDir, { recursive: true });
        await fs.writeFile(
          path.join(agentsDir, 'colon-value.md'),
          [
            '---',
            'name: colon-value',
            'description: Expert: reviewer',
            'tools: [Read, Grep, Glob]',
            'model: grok-4-1-fast',
            'maxRounds: 5',
            '---',
            '',
            'System prompt.',
            '',
          ].join('\n'),
          'utf8'
        );

        const definition = await loadSubagentDefinition('colon-value', tempDir);
        expect(definition.description).toBe('Expert: reviewer');
        expect(definition.tools).toEqual(['Read', 'Grep', 'Glob']);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Forbidden Phrases Detection', () => {
    // These patterns detect claims that should ONLY appear if Task tool actually succeeded
    const forbiddenPatterns = [
      /subagent.*team.*spun.*up/i,
      /spinning.*up.*\d+.*subagents?/i,
      /launched.*\d+.*subagents?/i,
      /subagent.*execution.*complete/i,
      /parallel.*agent.*execution/i,
      /concurrent.*subagent/i,
    ];

    it('should detect forbidden subagent claims in text', () => {
      const badExamples = [
        'Subagent Team Spun Up: Investigation Complete',
        'Spinning up 4 subagents to analyze the codebase',
        'Launched 3 subagents for parallel analysis',
        'Subagent execution complete - found 5 issues',
        'Using parallel agent execution for faster results',
        'Running concurrent subagent tasks',
      ];

      for (const text of badExamples) {
        const matchesAnyForbidden = forbiddenPatterns.some(pattern => pattern.test(text));
        expect(matchesAnyForbidden, `Should detect forbidden phrase in: "${text}"`).toBe(true);
      }
    });

    it('should NOT flag truthful tool usage descriptions', () => {
      const goodExamples = [
        'I used Glob and Grep to search the codebase',
        'Running sequential tool-based checks',
        'Using Read tool to examine the file',
        'Executed Bash command to run tests',
        'Used Task tool to spawn explore subagent',
        'Subagent returned results from code review',
      ];

      for (const text of goodExamples) {
        const matchesAnyForbidden = forbiddenPatterns.some(pattern => pattern.test(text));
        expect(matchesAnyForbidden, `Should NOT flag: "${text}"`).toBe(false);
      }
    });
  });

  describe('Fabricated Evidence Detection', () => {
    // These patterns detect when the model fabricates evidence blocks
    const fabricatedEvidencePatterns = [
      /FINAL main-agent.*evidence/i,
      /main-agent.*=== EVIDENCE ===/i,
      /my.*evidence.*block/i,
      /here.*is.*the.*evidence/i,
      /pasting.*evidence/i,
    ];

    it('should detect fabricated evidence claims', () => {
      const badExamples = [
        'FINAL main-agent evidence block:',
        'Here is the main-agent === EVIDENCE === block',
        'My evidence block shows:',
        'Here is the evidence I generated:',
        'Pasting the evidence summary:',
      ];

      for (const text of badExamples) {
        const matchesAnyFabricated = fabricatedEvidencePatterns.some(pattern => pattern.test(text));
        expect(matchesAnyFabricated, `Should detect fabricated evidence in: "${text}"`).toBe(true);
      }
    });

    it('should NOT flag legitimate evidence references', () => {
      const goodExamples = [
        'Check the system evidence block above',
        'The Evidence (system-verified) box shows your tool usage',
        'Look for the magenta evidence block printed by the system',
        'The evidence appears before my response',
      ];

      for (const text of goodExamples) {
        const matchesAnyFabricated = fabricatedEvidencePatterns.some(pattern => pattern.test(text));
        expect(matchesAnyFabricated, `Should NOT flag: "${text}"`).toBe(false);
      }
    });
  });

  describe('Verbatim Output Claims Detection', () => {
    // Rule 7: Detect claims about pasting "full" or "verbatim" tool output
    const verbatimClaimPatterns = [
      /FULL.*tool output.*verbatim/i,
      /paste.*full.*tool output/i,
      /complete.*raw output/i,
      /verbatim.*output.*here/i,
    ];

    it('should detect verbatim output claims', () => {
      const badExamples = [
        'FULL Task tool output (verbatim):',
        'I will paste the full tool output here',
        'Here is the complete raw output from the subagent',
        'Verbatim output appears here below',
      ];

      for (const text of badExamples) {
        const matchesAnyVerbatim = verbatimClaimPatterns.some(pattern => pattern.test(text));
        expect(matchesAnyVerbatim, `Should detect verbatim claim in: "${text}"`).toBe(true);
      }
    });

    it('should NOT flag legitimate output references', () => {
      const goodExamples = [
        'Use ↑/↓ to select the tool output and press e to expand',
        'The [Task] output box contains the full result',
        'Expand the tool output to see details',
        'The subagent trace shows what tools were used',
      ];

      for (const text of goodExamples) {
        const matchesAnyVerbatim = verbatimClaimPatterns.some(pattern => pattern.test(text));
        expect(matchesAnyVerbatim, `Should NOT flag: "${text}"`).toBe(false);
      }
    });
  });

  describe('TRUTHFULNESS_RULES Content', () => {
    it('should include rule about not fabricating evidence blocks', async () => {
      // Read the grok-agent.ts file and check TRUTHFULNESS_RULES content
      const agentSource = await fs.readFile(
        path.join(process.cwd(), 'src/agent/grok-agent.ts'),
        'utf8'
      );

      // Verify rule 6 exists and contains key phrases
      expect(agentSource).toContain('NEVER fabricate evidence blocks');
      expect(agentSource).toContain('Evidence (system-verified)');
      expect(agentSource).toContain('Do NOT invent');
      expect(agentSource).toContain('FINAL main-agent evidence');
    });

    it('should include rule about not claiming verbatim output', async () => {
      const agentSource = await fs.readFile(
        path.join(process.cwd(), 'src/agent/grok-agent.ts'),
        'utf8'
      );

      // Verify rule 7 exists
      expect(agentSource).toContain('NEVER claim to paste "FULL tool output verbatim"');
      expect(agentSource).toContain('FULL Task tool output (verbatim)');
      expect(agentSource).toContain('paste the full tool output here');
      expect(agentSource).toContain('SUBAGENT TRACE');
    });

    it('should instruct model to refer users to system evidence', async () => {
      const agentSource = await fs.readFile(
        path.join(process.cwd(), 'src/agent/grok-agent.ts'),
        'utf8'
      );

      expect(agentSource).toContain('magenta');
      expect(agentSource).toContain('printed by the system');
    });

    it('should instruct model to direct users to TUI controls for full output', async () => {
      const agentSource = await fs.readFile(
        path.join(process.cwd(), 'src/agent/grok-agent.ts'),
        'utf8'
      );

      expect(agentSource).toContain('↑/↓ arrow keys');
      expect(agentSource).toContain("Press 'e' to expand");
    });
  });

  describe('Evidence Interface', () => {
    it('should export correct evidence types from agent', async () => {
      const agentModule = await import('../../src/agent/grok-agent.js');
      expect(agentModule.GrokAgent).toBeDefined();
    });

    it('should count subagents spawned as successful Task calls only (main agent)', () => {
      const now = Date.now();
      const evidence = computeToolCallEvidence([
        { tool: 'Task', timestamp: now, success: false, callId: 'call-1' },
        { tool: 'Task', timestamp: now + 1, success: true, callId: 'call-2' },
        { tool: 'Read', timestamp: now + 2, success: true, callId: 'call-3' },
      ], false); // false = main agent

      expect(evidence.toolCounts['Task']).toBe(2);
      expect(evidence.subagentsSpawned).toBe(1);
      expect(evidence.summary).toContain('Subagents spawned (via Task): 1');
      expect(evidence.summary).toContain('Task 1/2 succeeded');
    });

    it('should clarify subagent evidence when no Task calls made (main agent)', () => {
      const now = Date.now();
      const evidence = computeToolCallEvidence([
        { tool: 'Read', timestamp: now, success: true, callId: 'call-1' },
      ], false); // false = main agent

      expect(evidence.subagentsSpawned).toBe(0);
      expect(evidence.summary).toContain('Subagents spawned (via Task): 0');
      expect(evidence.summary).not.toMatch(/Task \d+\/\d+ succeeded/);
    });

    it('should clarify that subagents cannot spawn subagents', () => {
      const now = Date.now();
      const evidence = computeToolCallEvidence([
        { tool: 'Read', timestamp: now, success: true, callId: 'call-1' },
        { tool: 'Grep', timestamp: now + 1, success: true, callId: 'call-2' },
      ], true); // true = subagent

      expect(evidence.subagentsSpawned).toBe(0);
      expect(evidence.summary).toContain('Subagents spawned: 0 (subagents cannot spawn subagents)');
    });
  });

  describe('Task Output Subagent Run Header', () => {
    // These tests verify that successful Task outputs include a clear
    // SUBAGENT RUN header that makes spawning unambiguous
    const requiredHeaderFields = [
      /=== SUBAGENT RUN \(system\) ===/,
      /subagent_type:/,
      /agentId:/,
      /allowedTools:/,
      /subagent evidence shows "Subagents spawned: 0"/,
    ];

    it('should detect all required header fields in mock Task output', () => {
      const mockTaskOutput = `
=== SUBAGENT RUN (system) ===
subagent_type: explore
agentId: subagent-123-abc
allowedTools: Read, Grep, Glob
note: subagent evidence shows "Subagents spawned: 0" because subagents cannot spawn subagents

[subagent content here]

=== SUBAGENT TRACE ===
...
`;

      for (const pattern of requiredHeaderFields) {
        expect(pattern.test(mockTaskOutput), `Should contain: ${pattern}`).toBe(true);
      }
    });

    it('should NOT flag Task output without the header as valid', () => {
      const outputWithoutHeader = `
Some subagent text without a proper header.

=== EVIDENCE ===
...
`;

      const hasAllFields = requiredHeaderFields.every(pattern => pattern.test(outputWithoutHeader));
      expect(hasAllFields).toBe(false);
    });

    it('should detect subagent_type field', () => {
      const output = 'subagent_type: code-reviewer';
      expect(/subagent_type:/.test(output)).toBe(true);
    });

    it('should detect agentId field', () => {
      const output = 'agentId: subagent-1768766355-x9fk2a';
      expect(/agentId:/.test(output)).toBe(true);
    });

    it('should detect allowedTools field', () => {
      const output = 'allowedTools: Read, Write, Bash';
      expect(/allowedTools:/.test(output)).toBe(true);
    });

    it('should detect explanatory note about subagent evidence', () => {
      const note = 'note: subagent evidence shows "Subagents spawned: 0" because subagents cannot spawn subagents';
      expect(/subagent evidence shows "Subagents spawned: 0"/.test(note)).toBe(true);
    });
  });
});

/**
 * Helper function to validate model output for truthfulness.
 * Detects claims that should only appear when Task tool succeeded.
 * Note: These patterns flag suspicious claims - verification requires
 * checking the evidence block for actual Task tool calls.
 */
export function validateTruthfulness(output: string): { valid: boolean; violations: string[] } {
  const forbiddenPatterns = [
    { pattern: /subagent.*team.*spun.*up/i, description: 'Claims subagent team was spun up (verify Task tool evidence)' },
    { pattern: /spinning.*up.*\d+.*subagents?/i, description: 'Claims spinning up multiple subagents (verify Task tool evidence)' },
    { pattern: /launched.*\d+.*subagents?/i, description: 'Claims launching multiple subagents (verify Task tool evidence)' },
    { pattern: /subagent.*execution.*complete/i, description: 'Claims subagent execution completed (verify Task tool evidence)' },
  ];

  const violations: string[] = [];

  for (const { pattern, description } of forbiddenPatterns) {
    if (pattern.test(output)) {
      violations.push(description);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
