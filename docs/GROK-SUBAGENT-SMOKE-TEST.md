Subagent smoke test (REAL Task execution)

1) Call the Task tool with EXACT JSON:
{"subagent_type":"explore","prompt":"Use only Glob/Read/Grep. Restrict to src/**. Find computeToolCallEvidence and return exact file:line:content for (a) the taskSuccesses increment line and (b) where subagentsSpawned is derived from taskSuccesses. Start with token-only search: Grep: \"taskSuccesses\" (do NOT use operator-regex like taskSuccesses++ or taskSuccesses+=). Then Read the surrounding lines for context and quote the exact matching code."}

2) Call the Task tool with EXACT JSON (expected to fail):
{"subagent_type":"does-not-exist","prompt":"noop"}

After both run:
- Tell me to look at the magenta “Evidence (system-verified)” box; it must show Tools executed: Task(2) and Subagents spawned (via Task): 1 (Task 1/2 succeeded).
- Tell me to expand the [Task] outputs (↑/↓ to select, e to expand) and confirm the successful Task output starts with:
  === SUBAGENT RUN (system) ===
  and includes:
  === SUBAGENT TRACE ===
- Do NOT paste or fabricate any “=== EVIDENCE ===” blocks in your message; only point me to the system evidence box and the expandable [Task] outputs.
