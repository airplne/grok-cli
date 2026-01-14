# Next Steps: PR Creation & GPT-5 Pro Review

## Current State

✅ **Branch Created**: `fix/grep-security-code-quality`
✅ **Commit Ready**: `c12907a` (6 files, +1987/-25 lines)
✅ **Tests Passing**: 68/68 tests across 3 files
❌ **Push Failed**: Network timeout to github.com

---

## Step 1: Push the Branch (Manual - when network available)

```bash
git push -u origin fix/grep-security-code-quality
```

**Expected Output**:
```
To https://github.com/airplne/grok-cli.git
 * [new branch]      fix/grep-security-code-quality -> fix/grep-security-code-quality
```

---

## Step 2: Create Pull Request

### Option A: Using GitHub CLI

```bash
gh pr create \
  --base main \
  --head fix/grep-security-code-quality \
  --title "security: harden grep tool fallback + add path-validator regression tests" \
  --body-file .grok/PR-BODY.md
```

### Option B: Using GitHub Web UI

1. Go to: https://github.com/airplne/grok-cli/compare/main...fix/grep-security-code-quality
2. Click "Create Pull Request"
3. Copy the title from `.grok/PR-BODY.md` (first line)
4. Copy the body content from `.grok/PR-BODY.md` (rest of file)
5. Click "Create pull request"

---

## Step 3: Get GPT-5 Pro Review

Once the PR is created, use the review prompt prepared at `.grok/GPT5-PRO-REVIEW-PROMPT.md`.

### How to Submit for Review:

1. Get the PR URL (e.g., `https://github.com/airplne/grok-cli/pull/123`)

2. Get the PR diff:
   ```bash
   # Option A: From local
   cat .grok/PR-DIFF.patch

   # Option B: From GitHub
   curl https://github.com/airplne/grok-cli/pull/123.diff
   ```

3. Send to GPT-5 Pro:
   - Copy the full prompt from `.grok/GPT5-PRO-REVIEW-PROMPT.md`
   - Add the PR URL where indicated
   - Attach or paste the diff
   - Submit for review

4. Wait for GPT-5 Pro response with findings

5. Address any CRITICAL or HIGH severity findings before merge

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| PR contains only 6 in-scope files | ✅ VERIFIED (c12907a) |
| `npm test -- --run` passes 68/68 | ✅ VERIFIED |
| `npm test` watch mode doesn't crash with ELOOP | ✅ VERIFIED |
| docs/PR-CODEX-FIXES-IMPLEMENTATION.md matches code/tests | ✅ VERIFIED |
| GPT-5 Pro review completed | ⏳ PENDING |
| All CRITICAL/HIGH items addressed | ⏳ PENDING |

---

## Quick Reference

| File | Purpose |
|------|---------|
| `.grok/PR-BODY.md` | PR description (ready to use) |
| `.grok/GPT5-PRO-REVIEW-PROMPT.md` | Review prompt for GPT-5 Pro |
| `.grok/PR-DIFF.patch` | Full PR diff (2098 lines) |
| `.grok/NEXT-STEPS.md` | This file |

---

## Current Branch Info

```
Branch: fix/grep-security-code-quality
Commit: c12907a
Base: origin/main
Files: 6
Tests: 68/68 passing
```

**Ready for push when network is available!**
