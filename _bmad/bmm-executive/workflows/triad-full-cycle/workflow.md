---
name: triad-full-cycle
description: 'End-to-end orchestration: Discovery → Build → Ship'
author: 'BMad Triad'
orchestrator: true

# Critical variables from config
config_source: '{project-root}/_bmad/bmm-executive/config.yaml'
output_folder: '{config_source}:output_folder'
user_name: '{config_source}:user_name'
communication_language: '{config_source}:communication_language'
date: system-generated

# Workflow components
installed_path: '{project-root}/_bmad/bmm-executive/workflows/triad-full-cycle'
project_context: '**/project-context.md'

# Sub-workflows
discovery_workflow: '{project-root}/_bmad/bmm-executive/workflows/triad-discovery/workflow.md'
build_workflow: '{project-root}/_bmad/bmm-executive/workflows/triad-build/workflow.md'
ship_workflow: '{project-root}/_bmad/bmm-executive/workflows/triad-ship/workflow.md'

standalone: true
---

# Triad Full Cycle Workflow

**Goal:** Orchestrate the complete product development cycle from idea to shipped feature.

**Orchestration Pattern:** Sequential execution of Discovery → Build → Ship

---

## WORKFLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRIAD FULL CYCLE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │    DISCOVERY    │────▶│      BUILD      │────▶│      SHIP       │       │
│  │                 │     │                 │     │                 │       │
│  │ Lead: Sage (SM) │     │ Lead: Theo (TA) │     │ Lead: Finn (FM) │       │
│  │ + Finn (UX)     │     │ + Sage (reqs)   │     │ + Theo (handoff)│       │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│         │                        │                        │                │
│         ▼                        ▼                        ▼                │
│    PRD + Epics              Architecture +          Release +              │
│    + UX Direction           Implementation          Documentation          │
│                                                                             │
│  ◄─────────────────────── FEEDBACK LOOP ────────────────────────────────▶  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## EXECUTION INSTRUCTIONS

### Phase 1: Initialize Full Cycle

"Welcome to the Triad Full Cycle! I'll guide you through the complete product development journey:

1. **Discovery** (Strategist Marketer leads) - Define what we're building and why
2. **Build** (Technologist Architect leads) - Design and implement the solution
3. **Ship** (Fulfillization Manager leads) - Deliver, document, and learn

Each phase hands off to the next with explicit checkpoints. Ready to begin?"

### Cycle State Tracking

```yaml
# Track cycle state across phases
triad_cycle:
  id: '{date}-{feature_name}'
  started: '{date}'
  current_phase: 'discovery' # discovery | build | ship | complete

  discovery:
    status: 'not_started' # not_started | in_progress | complete
    lead: 'strategist-marketer'
    artifacts: []
    handoff_accepted: false

  build:
    status: 'not_started'
    lead: 'technologist-architect'
    artifacts: []
    handoff_accepted: false

  ship:
    status: 'not_started'
    lead: 'fulfillization-manager'
    artifacts: []
    cycle_complete: false
```

---

## PHASE EXECUTION

### Discovery Phase

**Invoke:** `{discovery_workflow}`

**Entry Criteria:**

- User has an idea, problem, or opportunity
- Starting from scratch or has partial documentation

**Exit Criteria:**

- PRD or Product Brief complete
- Requirements prioritized
- UX direction established
- Handoff checklist complete

**Handoff Checkpoint:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              DISCOVERY → BUILD CHECKPOINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Discovery artifacts ready for Build:
- [ ] PRD/Product Brief
- [ ] Prioritized requirements
- [ ] UX direction

Proceed to Build phase?
  [Y] Yes, begin Build
  [R] Review/revise Discovery outputs
  [P] Pause cycle (resume later)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Build Phase

**Invoke:** `{build_workflow}`

**Entry Criteria:**

- Discovery handoff accepted
- Requirements clear and prioritized
- UX direction available

**Exit Criteria:**

- Architecture documented
- Implementation complete
- Tests passing
- Code quality verified

**Handoff Checkpoint:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               BUILD → SHIP CHECKPOINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Build artifacts ready for Ship:
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Architecture documented
- [ ] Known issues flagged

Proceed to Ship phase?
  [Y] Yes, begin Ship
  [R] Review/revise Build outputs
  [P] Pause cycle (resume later)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Ship Phase

**Invoke:** `{ship_workflow}`

**Entry Criteria:**

- Build handoff accepted
- Implementation complete and tested
- Technical documentation available

**Exit Criteria:**

- User experience validated
- Documentation complete
- Release executed
- Retrospective insights captured

**Cycle Complete:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              🎉 TRIAD CYCLE COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cycle Summary:
  Started: {start_date}
  Completed: {end_date}

Discovery:
  - [Artifacts created]

Build:
  - [Features implemented]
  - [Test coverage]

Ship:
  - [Release version]
  - [Documentation status]

Feedback for Next Cycle:
  - [Key insight 1]
  - [Key insight 2]

Next Steps:
  [N] Start new Triad cycle
  [I] Iterate on current feature
  [D] Done for now

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## FLEXIBLE ENTRY POINTS

The full cycle can be entered at any phase:

### Starting from Discovery

- Invoke triad-full-cycle
- Begin with Discovery phase

### Starting from Build (have requirements)

- Invoke triad-full-cycle
- Skip to Build phase with existing requirements
- "I already have requirements. Let's start at Build."

### Starting from Ship (have implementation)

- Invoke triad-full-cycle
- Skip to Ship phase with existing implementation
- "Implementation is done. Let's start at Ship."

### Resume Paused Cycle

- Load previous cycle state
- Resume from last checkpoint

---

## MAJOR DECISION DISCUSSIONS

For significant decisions that span multiple domains, invoke party mode:

```
When facing decisions like:
- "Should we change the core architecture?"
- "Is this feature scope correct?"
- "Are we building the right thing?"

Invoke: {project-root}/_bmad/core/workflows/party-mode/workflow.md

Party participants:
- Sage (Strategist Marketer) - Business impact perspective
- Theo (Technologist Architect) - Technical feasibility perspective
- Finn (Fulfillization Manager) - Delivery & UX perspective
```

---

## CYCLE INTERRUPTIONS

### Course Correction

If major issues emerge mid-cycle:

1. **Pause current phase**
2. **Assess impact:**
   - Discovery issue → Return to Discovery
   - Architecture issue → Return to Build
   - Requirements changed → May need Discovery re-evaluation
3. **Document the pivot**
4. **Resume appropriate phase**

### Abort Cycle

If the feature/project should be stopped:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              CYCLE ABORT CONFIRMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Are you sure you want to abort this cycle?

Reason: [User provides reason]

Work completed:
- [List completed work]

Work that would be lost/abandoned:
- [List in-progress work]

[A] Abort and archive
[P] Pause instead (can resume later)
[C] Continue cycle

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## SUCCESS METRICS

A successful Triad Full Cycle results in:

- [ ] Clear requirements validated against user needs
- [ ] Sound architecture documented and implemented
- [ ] Working, tested code that meets acceptance criteria
- [ ] Shipped feature with appropriate documentation
- [ ] Insights captured for future cycles
- [ ] All three agents contributed their expertise
- [ ] Clean handoffs between phases

---

## WHEN TO USE FULL CYCLE vs INDIVIDUAL WORKFLOWS

**Use Full Cycle when:**

- Starting a new feature from scratch
- Want guided orchestration through all phases
- Need explicit checkpoints and handoffs

**Use Individual Workflows when:**

- Already mid-project with existing artifacts
- Only need one phase (e.g., just need architecture)
- Iterating on a shipped feature
- Experienced with the triad and want flexibility
