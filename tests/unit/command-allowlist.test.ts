/**
 * Unit Tests: Command Allowlist
 * Tests security validation for Bash tool commands
 */

import { describe, it, expect } from 'vitest';
import { isCommandAllowed, _internals } from '../../src/security/command-allowlist.js';

describe('Command Allowlist', () => {
  describe('grok commands', () => {
    it('allows grok --version', () => {
      const result = isCommandAllowed('grok --version');
      expect(result.valid).toBe(true);
    });

    it('allows grok auth doctor', () => {
      const result = isCommandAllowed('grok auth doctor');
      expect(result.valid).toBe(true);
    });

    it('allows grok auth status', () => {
      const result = isCommandAllowed('grok auth status');
      expect(result.valid).toBe(true);
    });

    it('blocks bare grok (interactive mode)', () => {
      const result = isCommandAllowed('grok');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Interactive grok session');
    });

    it('blocks grok with only whitespace', () => {
      const result = isCommandAllowed('grok   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Interactive grok session');
    });
  });

  describe('shell injection prevention', () => {
    it('blocks pipe operators', () => {
      const result = isCommandAllowed('echo hi | grok --version');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('command chaining');
    });

    it('blocks semicolon chaining', () => {
      const result = isCommandAllowed('grok --version; rm -rf /');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('command chaining');
    });

    it('blocks command substitution', () => {
      const result = isCommandAllowed('grok $(cat /etc/passwd)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('command substitution');
    });

    it('blocks output redirection', () => {
      const result = isCommandAllowed('grok --version > /tmp/out');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('redirection');
    });
  });

  describe('blocked commands', () => {
    it('blocks rm', () => {
      const result = isCommandAllowed('rm -rf /');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked command');
    });

    it('blocks sudo', () => {
      const result = isCommandAllowed('sudo ls');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked command');
    });

    it('blocks curl', () => {
      const result = isCommandAllowed('curl http://evil.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked command');
    });
  });

  describe('allowed commands', () => {
    it('allows git status', () => {
      const result = isCommandAllowed('git status');
      expect(result.valid).toBe(true);
    });

    it('allows npm test', () => {
      const result = isCommandAllowed('npm test');
      expect(result.valid).toBe(true);
    });

    it('allows ls -la', () => {
      const result = isCommandAllowed('ls -la');
      expect(result.valid).toBe(true);
    });
  });

  describe('dangerous subcommands', () => {
    it('blocks git push --force', () => {
      const result = isCommandAllowed('git push --force');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Destructive git operation');
    });

    it('blocks git reset --hard', () => {
      const result = isCommandAllowed('git reset --hard HEAD~1');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Destructive git operation');
    });
  });
});
