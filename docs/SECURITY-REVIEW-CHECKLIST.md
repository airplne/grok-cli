# Security Review Checklist - Post Phase 2

**Run this security review after completing Phase 2 (Session Management)**

---

## Why Security Review After Phase 2?

Phase 2 introduces:
- **File storage** (session files in `.grok/sessions/`)
- **User input in filenames** (session names/IDs)
- **Data persistence** (conversations may contain sensitive info)

These create new attack surfaces that must be reviewed.

---

## Checklist

### 1. Session Storage Security

**File:** `src/session/storage.ts`

- [ ] **Path Traversal Prevention**
  ```typescript
  // Verify session IDs are validated before file operations
  // Test: Try to save session with ID: "../../../etc/passwd"
  // Expected: Blocked by path validator or UUID validation
  ```

- [ ] **Filename Injection**
  ```typescript
  // Verify session names don't contain path separators
  // Test: /session save "../../secrets"
  // Expected: Sanitized or rejected
  ```

- [ ] **Symlink Attacks**
  ```typescript
  // Verify session loading uses fs.realpath (like path-validator.ts)
  // Test: Create symlink in sessions dir pointing to /etc/passwd
  // Expected: Blocked or resolved safely
  ```

- [ ] **File Permissions**
  ```bash
  # Verify session files are created with secure permissions
  ls -la ~/.grok/sessions/*.json
  # Expected: 600 (rw-------) or stricter
  ```

### 2. Session Data Security

**Files:** `src/session/manager.ts`, `src/commands/handlers/session/*.ts`

- [ ] **Sensitive Data in Sessions**
  ```typescript
  // Verify API keys/tokens aren't stored in session files
  // Check: Does session JSON contain GROK_API_KEY or similar?
  // Expected: No credentials stored
  ```

- [ ] **Session Export Security**
  ```typescript
  // Test: /export session.json
  // Review exported file - does it contain:
  //   - API keys? (should be NO)
  //   - File contents from Read tool? (OK)
  //   - Command history with passwords? (review case-by-case)
  ```

- [ ] **Session Encryption**
  ```typescript
  // Consider: Should sessions be encrypted at rest?
  // Recommendation: Add optional encryption for sensitive projects
  // Implementation: Use crypto.createCipheriv before write
  ```

### 3. Input Validation

**Files:** All session command handlers

- [ ] **Session ID Validation**
  ```typescript
  // Verify session IDs are UUIDs or sanitized strings
  // Test: /resume "'; DROP TABLE sessions; --"
  // Expected: Rejected or sanitized
  ```

- [ ] **Session Name Validation**
  ```typescript
  // Verify session names are sanitized
  // Test: /rename "<script>alert('xss')</script>"
  // Expected: Sanitized or rejected (even though it's CLI, not web)
  ```

- [ ] **Export Path Validation**
  ```typescript
  // Verify export paths use path-validator.ts
  // Test: /export --output /etc/passwd
  // Expected: Blocked by path validator
  ```

### 4. Command Injection via Session Data

**File:** `src/session/manager.ts`

- [ ] **No eval() or exec() on Session Data**
  ```typescript
  // Verify session data is not executed as code
  // Check: No eval(), Function(), or similar on session.messages
  ```

- [ ] **Safe JSON Parsing**
  ```typescript
  // Verify JSON.parse errors are caught
  // Test: Corrupt a session file, try to load
  // Expected: Graceful error, no crash
  ```

### 5. Reuse Existing Security Infrastructure

**Verify these are used:**

- [ ] **Path Validator**
  ```typescript
  // Session file operations should use validatePath()
  import { validatePath } from '../security/path-validator.js';

  // Before any session file write/read:
  const validated = await validatePath(sessionPath, { allowNonExistent: true, operation: 'write' });
  ```

- [ ] **Command Allowlist** (if session export executes commands)
  ```typescript
  // If /export supports running export scripts:
  import { isCommandAllowed } from '../security/command-allowlist.js';
  ```

### 6. Rate Limiting (DoS Prevention)

- [ ] **Session Creation Rate Limiting**
  ```typescript
  // Prevent creating thousands of sessions rapidly
  // Consider: Max 100 sessions per project or global cleanup
  ```

- [ ] **Session Load Performance**
  ```typescript
  // Verify loading large sessions doesn't cause DoS
  // Test: Create session with 10,000 messages, try to load
  // Expected: Loads in <2 seconds or pagination implemented
  ```

### 7. Audit Logging

- [ ] **Log Security Events**
  ```typescript
  // Add logging for:
  // - Session file access denied
  // - Invalid session ID attempts
  // - Path traversal blocks
  // Use existing logger from src/lib/logger.ts
  ```

---

## Testing Script

Create `test-session-security.sh`:

```bash
#!/bin/bash

echo "Session Security Tests"
echo "====================="

# Test 1: Path traversal in session ID
echo "Test 1: Path traversal"
grok
/session save "../../../etc/passwd"
# Expected: Error or sanitized

# Test 2: Symlink attack
echo "Test 2: Symlink attack"
cd ~/.grok/sessions
ln -s /etc/passwd fake-session.json
grok
/resume fake-session
# Expected: Blocked

# Test 3: Large session DoS
echo "Test 3: Large session"
# Create session with 10,000 messages (script this)
grok
/resume large-session
# Expected: Loads within 2 seconds

# Test 4: Export path traversal
echo "Test 4: Export security"
grok
/export --output /etc/passwd
# Expected: Blocked by path validator

# Test 5: Filename injection
echo "Test 5: Filename injection"
grok
/session save "test; rm -rf /"
# Expected: Sanitized or rejected

echo "All tests complete"
```

---

## Security Review Sign-off

After completing Phase 2, have a security-focused reviewer check:

- [ ] All checklist items above pass
- [ ] No new OWASP Top 10 vulnerabilities introduced
- [ ] Session storage follows principle of least privilege
- [ ] No credentials leak in session files
- [ ] Path validation used consistently

**Reviewer:** _________________
**Date:** _________________
**Approved:** [ ] Yes [ ] No (see issues)

---

## Quick Fixes if Issues Found

### If path traversal found:
```typescript
// In session/storage.ts
import { validatePath } from '../security/path-validator.js';

async save(session: Session): Promise<void> {
  const sessionPath = path.join(this.baseDir, `${session.id}.json`);
  const validated = await validatePath(sessionPath, { allowNonExistent: true, operation: 'write' });
  if (!validated.valid) throw new SecurityError(validated.error);
  // ... proceed with save
}
```

### If credentials leak found:
```typescript
// Add session data sanitizer
function sanitizeSession(session: Session): Session {
  return {
    ...session,
    messages: session.messages.map(m => ({
      ...m,
      content: sanitizeContent(m.content)  // Strip API keys, tokens
    }))
  };
}
```

---

**This checklist should be run before merging Phase 2 to main branch.**
