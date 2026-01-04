---
name: triad-build
description: 'Architecture → Implementation: Lead by Technologist Architect with Strategist Marketer requirements clarity'
author: 'BMad Triad'
lead_agent: technologist-architect
supporting_agents: [strategist-marketer]

# Critical variables from config
config_source: '{project-root}/_bmad/bmm-executive/config.yaml'
output_folder: '{config_source}:output_folder'
user_name: '{config_source}:user_name'
communication_language: '{config_source}:communication_language'
document_output_language: '{config_source}:document_output_language'
planning_artifacts: '{config_source}:planning_artifacts'
implementation_artifacts: '{config_source}:implementation_artifacts'
date: system-generated

# Workflow components
installed_path: '{project-root}/_bmad/bmm-executive/workflows/triad-build'
project_context: '**/project-context.md'

# Input artifacts (from discovery)
prd_input: '{planning_artifacts}/prd.md'
epics_input: '{planning_artifacts}/epics-and-stories.md'
ux_input: '{planning_artifacts}/ux-design.md'

# Output artifacts
architecture_output: '{planning_artifacts}/architecture.md'
tech_spec_output: '{planning_artifacts}/tech-spec.md'

standalone: true
---

# Triad Build Workflow

**Goal:** Transform requirements into architecture and working implementation.

**Lead Agent:** Technologist Architect (Theo)
**Supporting:** Strategist Marketer (Sage) - Requirements clarification

---

## WORKFLOW OVERVIEW

This workflow guides you through the Build phase of product development:

```
┌─────────────────────────────────────────────────────────────┐
│                      TRIAD BUILD                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Architecture Design                                │
│  └── System structure? Key decisions? Patterns?             │
│                                                             │
│  Step 2: Technical Specification                            │
│  └── Implementation plan? Task breakdown? Dependencies?     │
│                                                             │
│  Step 3: Implementation                                     │
│  └── Code it! Test it! Ship it! (with quality gates)        │
│                                                             │
│  Step 4: Quality Assurance                                  │
│  └── Tests passing? Code review? Meets acceptance criteria? │
│                                                             │
│  Step 5: Handoff Preparation                                │
│  └── Ready for delivery? Documentation needed?              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## EXECUTION INSTRUCTIONS

### Pre-Flight Check

Before starting, verify inputs:

```markdown
## Build Phase Pre-Flight Checklist

### Required Inputs

- [ ] PRD or Product Brief exists
- [ ] Requirements are prioritized (P0/P1/P2 or MoSCoW)
- [ ] Success metrics defined
- [ ] Scope boundaries clear

### Optional But Recommended

- [ ] UX direction documented
- [ ] Epics/stories drafted
- [ ] User journeys mapped

### Context Loading

- [ ] Load project-context.md if exists
- [ ] Scan existing codebase patterns (for brownfield)
```

**If inputs missing:** Direct user back to Strategist Marketer for discovery.

### Step 1: Architecture Design

**Lead:** Technologist Architect

"Let's design the system architecture. I'll balance what could be built with what should be built."

**For greenfield projects:**
Invoke architecture workflow: `{project-root}/_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.md`

**For quick/small projects:**
Create lightweight architecture decision record:

```markdown
# Architecture Decision Record

## Context

[What is the situation requiring architectural decisions?]

## Decision

[What is the chosen approach?]

## Rationale

[Why this approach? What tradeoffs were considered?]

## Consequences

[What follows from this decision?]

## Key Patterns

- [Pattern 1]: [Where/how used]
- [Pattern 2]: [Where/how used]

## Technology Choices

- [Technology]: [Purpose]
```

**Requirements Clarification (SM support):**
If any requirements are ambiguous during architecture:

- Flag the ambiguity
- Consult Strategist Marketer perspective: "Is this interpretation correct?"
- Document the clarification

### Step 2: Technical Specification

**Lead:** Technologist Architect

**For structured implementation:**
Invoke tech-spec workflow: `{project-root}/_bmad/bmm/workflows/bmad-quick-flow/create-tech-spec/workflow.yaml`

**Tech Spec Core Elements:**

```markdown
# Technical Specification: [Feature Name]

## Overview

[What are we building and why?]

## Architecture Impact

[How does this fit into the system architecture?]

## Implementation Tasks

### Task 1: [Name]

- Description: [What needs to be done]
- Acceptance Criteria: [How we know it's done]
- Dependencies: [What must exist first]
- Test Strategy: [How we test this]

[Additional tasks...]

## Test Plan

- Unit tests: [Coverage expectations]
- Integration tests: [Key integration points]
- E2E tests: [Critical user flows]

## Rollout Strategy

[How will this be deployed/released?]
```

### Step 3: Implementation

**Lead:** Technologist Architect

**Context-Aware Execution:**

Ask if unclear: "Is this exploratory or production-bound?"

**Exploratory/Spike Mode:**

- Rapid implementation, minimal ceremony
- Skip comprehensive test coverage for exploration
- Focus on validating approach

**Production Mode:**

- Red-green-refactor cycle
- Write failing test first
- Implement to make test pass
- Refactor while keeping tests green
- Comprehensive test coverage

**For structured story execution:**
Invoke quick-dev workflow: `{project-root}/_bmad/bmm/workflows/bmad-quick-flow/quick-dev/workflow.yaml`

**Implementation Rules:**

1. Follow project-context.md patterns if exists
2. Never implement outside acceptance criteria
3. All existing tests must pass before proceeding
4. Mark tasks complete only when tests pass

### Step 4: Quality Assurance

**Lead:** Technologist Architect

"Let's verify quality before handoff."

**Quality Checklist:**

```markdown
## Build Quality Checklist

### Code Quality

- [ ] All new code follows project conventions
- [ ] No obvious code smells or technical debt introduced
- [ ] Dependencies are intentional and minimal

### Test Coverage

- [ ] Unit tests cover core logic
- [ ] Integration tests verify key connections
- [ ] Critical user paths have E2E coverage (if applicable)

### Functionality

- [ ] All acceptance criteria met
- [ ] Edge cases handled appropriately
- [ ] Error states managed gracefully

### Performance

- [ ] No obvious performance regressions
- [ ] Resource usage is reasonable
```

**For formal code review:**
Invoke: `{project-root}/_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`

### Step 5: Handoff Preparation

**Lead:** Technologist Architect

"Implementation complete. Let's prepare for delivery."

**Handoff Checklist:**

```markdown
## Build → Ship Handoff Checklist

### Implementation Status

- [ ] All planned features implemented
- [ ] Tests passing (unit, integration, E2E)
- [ ] Code reviewed (or self-reviewed for solo dev)

### Documentation Needs

- [ ] API changes documented
- [ ] Configuration changes documented
- [ ] Breaking changes flagged

### Delivery Readiness

- [ ] Ready for deployment
- [ ] Rollback plan exists (if applicable)
- [ ] Monitoring/observability in place (if applicable)

### Handoff Statement

"The Technologist Architect confirms this implementation is ready
for delivery management by the Fulfillization Manager."
```

---

## WORKFLOW COMPLETION

When build is complete, present handoff summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    BUILD COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implementation Summary:
- [List implemented features]
- [Test coverage summary]
- [Key architectural decisions made]

Artifacts Created:
- [List created documents]

Files Changed:
- [List key file changes]

Ready for: Triad Ship (Testing → Delivery → Docs)

To continue the full cycle:
  → Invoke Fulfillization Manager with [TS] Triad Ship
  → Or invoke triad-full-cycle for automated orchestration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ARTIFACT COMPATIBILITY

All artifacts produced by this workflow are compatible with:

- Full BMM workflows (architecture, stories, specs)
- BMM-Triad workflows (triad-ship, triad-full-cycle)
- Standard implementation patterns

---

## SUCCESS METRICS

- [ ] Architecture documented (even if lightweight)
- [ ] Implementation complete per acceptance criteria
- [ ] Tests passing
- [ ] Code quality verified
- [ ] Handoff checklist complete
- [ ] Fulfillization Manager has what they need for delivery
