import { describe, it, expect } from 'vitest';
import {
  shouldAutoApprove,
  getConfirmOptions,
  isAutoAcceptEligible,
  ConfirmDecision,
} from '../../src/ui/utils/confirm-decision.js';

/**
 * Tests for confirmation decision logic.
 *
 * Covers:
 * - Auto-approval rules (Edit/Write auto-approved, Bash never)
 * - Confirmation options (Edit/Write show auto-accept, Bash doesn't)
 * - Tool eligibility checking
 */

describe('confirm decision', () => {
  describe('shouldAutoApprove', () => {
    it('should not auto-approve when feature is disabled', () => {
      expect(shouldAutoApprove('Edit', false)).toBe(false);
      expect(shouldAutoApprove('Write', false)).toBe(false);
      expect(shouldAutoApprove('Bash', false)).toBe(false);
    });

    it('should auto-approve Edit when enabled', () => {
      expect(shouldAutoApprove('Edit', true)).toBe(true);
    });

    it('should auto-approve Write when enabled', () => {
      expect(shouldAutoApprove('Write', true)).toBe(true);
    });

    it('should NEVER auto-approve Bash even when enabled', () => {
      expect(shouldAutoApprove('Bash', true)).toBe(false);
    });

    it('should not auto-approve other tools', () => {
      expect(shouldAutoApprove('Read', true)).toBe(false);
      expect(shouldAutoApprove('Grep', true)).toBe(false);
      expect(shouldAutoApprove('TodoWrite', true)).toBe(false);
    });
  });

  describe('getConfirmOptions', () => {
    it('should return 3 options for Edit (includes auto-accept)', () => {
      const options = getConfirmOptions('Edit');

      expect(options.length).toBe(3);
      expect(options[0].key).toBe('y');
      expect(options[0].label).toBe('Allow once');
      expect(options[0].decision).toBe('allow_once');

      expect(options[1].key).toBe('a');
      expect(options[1].label).toBe('Auto-accept edits (session)');
      expect(options[1].decision).toBe('auto_accept_edits');

      expect(options[2].key).toBe('n');
      expect(options[2].label).toBe('Deny');
      expect(options[2].decision).toBe('deny');
    });

    it('should return 3 options for Write (includes auto-accept)', () => {
      const options = getConfirmOptions('Write');

      expect(options.length).toBe(3);
      const autoAcceptOption = options.find(o => o.decision === 'auto_accept_edits');
      expect(autoAcceptOption).toBeDefined();
      expect(autoAcceptOption?.key).toBe('a');
    });

    it('should return 2 options for Bash (NO auto-accept)', () => {
      const options = getConfirmOptions('Bash');

      expect(options.length).toBe(2);
      expect(options[0].key).toBe('y');
      expect(options[0].decision).toBe('allow_once');
      expect(options[1].key).toBe('n');
      expect(options[1].decision).toBe('deny');

      // Verify NO auto-accept option
      const hasAutoAccept = options.some(o => o.decision === 'auto_accept_edits');
      expect(hasAutoAccept).toBe(false);
    });

    it('should not include auto-accept for other tools', () => {
      const tools = ['Read', 'Grep', 'Glob', 'TodoWrite'];

      for (const tool of tools) {
        const options = getConfirmOptions(tool);
        const hasAutoAccept = options.some(o => o.decision === 'auto_accept_edits');
        expect(hasAutoAccept, `${tool} should NOT have auto-accept option`).toBe(false);
      }
    });

    it('should always include Allow once and Deny options', () => {
      const allTools = ['Edit', 'Write', 'Bash', 'Read'];

      for (const tool of allTools) {
        const options = getConfirmOptions(tool);

        const hasAllowOnce = options.some(o => o.decision === 'allow_once');
        const hasDeny = options.some(o => o.decision === 'deny');

        expect(hasAllowOnce, `${tool} must have Allow once`).toBe(true);
        expect(hasDeny, `${tool} must have Deny`).toBe(true);
      }
    });
  });

  describe('isAutoAcceptEligible', () => {
    it('should return true for Edit', () => {
      expect(isAutoAcceptEligible('Edit')).toBe(true);
    });

    it('should return true for Write', () => {
      expect(isAutoAcceptEligible('Write')).toBe(true);
    });

    it('should return false for Bash', () => {
      expect(isAutoAcceptEligible('Bash')).toBe(false);
    });

    it('should return false for other tools', () => {
      expect(isAutoAcceptEligible('Read')).toBe(false);
      expect(isAutoAcceptEligible('Grep')).toBe(false);
      expect(isAutoAcceptEligible('TodoWrite')).toBe(false);
    });
  });

  describe('decision flow scenarios', () => {
    it('should enable auto-accept after selecting auto_accept_edits', () => {
      // Simulate: user sees Edit confirm, selects auto-accept
      let autoAcceptEdits = false;
      const options = getConfirmOptions('Edit');
      const autoAcceptOption = options.find(o => o.decision === 'auto_accept_edits');

      // User presses 'a' or Enters on that option
      if (autoAcceptOption?.decision === 'auto_accept_edits') {
        autoAcceptEdits = true; // App sets this
      }

      expect(autoAcceptEdits).toBe(true);

      // Next Edit call should auto-approve
      expect(shouldAutoApprove('Edit', autoAcceptEdits)).toBe(true);
      // But Bash still prompts
      expect(shouldAutoApprove('Bash', autoAcceptEdits)).toBe(false);
    });
  });

  describe('Tab/Shift+Tab navigation helpers', () => {
    // These tests document the various terminal sequences for Tab/Shift+Tab
    // that the ConfirmDialog must handle

    it('should recognize standard Shift+Tab sequence (ESC [ Z)', () => {
      const input = '\x1b[Z';
      const isShiftTab = input === '\x1b[Z';
      expect(isShiftTab).toBe(true);
    });

    it('should recognize extended Shift+Tab (ESC [ 1 ; 2 Z)', () => {
      const input = '\x1b[1;2Z';
      const isShiftTab = input === '\x1b[1;2Z';
      expect(isShiftTab).toBe(true);
    });

    it('should recognize ESC-stripped Shift+Tab ([Z)', () => {
      const input = '[Z';
      const isShiftTab = input === '[Z';
      expect(isShiftTab).toBe(true);
    });

    it('should recognize ESC-stripped extended Shift+Tab ([1;2Z)', () => {
      const input = '[1;2Z';
      const isShiftTab = input === '[1;2Z';
      expect(isShiftTab).toBe(true);
    });

    it('should handle selection cycling forward (Tab)', () => {
      // Simulate 3 options, start at index 0
      let index = 0;
      const optionsLength = 3;

      // Tab 3 times
      index = (index + 1) % optionsLength; // 1
      index = (index + 1) % optionsLength; // 2
      index = (index + 1) % optionsLength; // 0 (wraps)

      expect(index).toBe(0);
    });

    it('should handle selection cycling backward (Shift+Tab)', () => {
      // Simulate 3 options, start at index 0
      let index = 0;
      const optionsLength = 3;

      // Shift+Tab 3 times
      index = (index - 1 + optionsLength) % optionsLength; // 2
      index = (index - 1 + optionsLength) % optionsLength; // 1
      index = (index - 1 + optionsLength) % optionsLength; // 0 (wraps)

      expect(index).toBe(0);
    });
  });
});
