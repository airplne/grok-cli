---
name: triad-ship
description: 'Testing → Delivery → Docs: Lead by Fulfillization Manager with Technologist Architect technical handoff'
author: 'BMad Triad'
lead_agent: fulfillization-manager
supporting_agents: [technologist-architect]

# Critical variables from config
config_source: '{project-root}/_bmad/bmm-executive/config.yaml'
output_folder: '{config_source}:output_folder'
user_name: '{config_source}:user_name'
communication_language: '{config_source}:communication_language'
document_output_language: '{config_source}:document_output_language'
planning_artifacts: '{config_source}:planning_artifacts'
implementation_artifacts: '{config_source}:implementation_artifacts'
project_knowledge: '{config_source}:project_knowledge'
date: system-generated

# Workflow components
installed_path: '{project-root}/_bmad/bmm-executive/workflows/triad-ship'
project_context: '**/project-context.md'

standalone: true
---

# Triad Ship Workflow

**Goal:** Transform implemented code into delivered, documented, operational reality.

**Lead Agent:** Fulfillization Manager (Finn)
**Supporting:** Technologist Architect (Theo) - Technical handoff

---

## WORKFLOW OVERVIEW

This workflow guides you through the Ship phase of product development:

```
┌─────────────────────────────────────────────────────────────┐
│                       TRIAD SHIP                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Delivery Handoff                                   │
│  └── Accept from build, verify completeness                 │
│                                                             │
│  Step 2: Final Testing & Quality                            │
│  └── User acceptance, edge cases, polish                    │
│                                                             │
│  Step 3: Documentation                                      │
│  └── User docs, API docs, operational docs                  │
│                                                             │
│  Step 4: Release & Deploy                                   │
│  └── Release notes, deployment, monitoring                  │
│                                                             │
│  Step 5: Retrospective & Feedback Loop                      │
│  └── What worked? What didn't? Feed back to strategy        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## EXECUTION INSTRUCTIONS

### Pre-Flight Check

Before starting, verify inputs from Build phase:

```markdown
## Ship Phase Pre-Flight Checklist

### Required Inputs

- [ ] Implementation complete (from Technologist Architect)
- [ ] Tests passing
- [ ] Code reviewed or self-reviewed
- [ ] Acceptance criteria met

### Technical Handoff

- [ ] Architecture documentation available
- [ ] Key decisions documented
- [ ] Breaking changes flagged
- [ ] Configuration changes documented
```

**If inputs incomplete:** Coordinate with Technologist Architect to close gaps.

### Step 1: Delivery Handoff

**Lead:** Fulfillization Manager with **Technologist Architect** input

"Let me accept the handoff from build and verify completeness."

**Handoff Acceptance Checklist:**

```markdown
## Build → Ship Handoff Acceptance

### From Technologist Architect

Received:

- [ ] Implementation summary
- [ ] Test coverage report
- [ ] Files changed list
- [ ] Known issues or limitations
- [ ] Documentation needs

### Verification

- [ ] Demo/walkthrough completed (or self-verified)
- [ ] Acceptance criteria checklist reviewed
- [ ] Outstanding items identified

### Acceptance Statement

"The Fulfillization Manager accepts this implementation for
delivery management. Outstanding items: [list or 'none']"
```

### Step 2: Final Testing & Quality

**Lead:** Fulfillization Manager

"Let's ensure this is ready for users, not just technically complete."

**User Experience Validation:**

1. **Critical Path Testing:**
   - Walk through the main user journeys
   - Note any friction points
   - Verify error states are handled gracefully

2. **Edge Case Review:**
   - What happens with empty states?
   - What happens with large data?
   - What happens with slow network?

3. **Polish Check:**
   - Loading states appropriate?
   - Error messages helpful?
   - Success feedback clear?

**If issues found:**

- Document with specifics
- Determine: block ship or track for follow-up
- Coordinate fix with Technologist Architect if blocking

### Step 3: Documentation

**Lead:** Fulfillization Manager

"Every great feature deserves documentation that helps users succeed."

**Documentation Assessment:**

```markdown
## Documentation Needs Assessment

### User-Facing (if applicable)

- [ ] Feature overview/description
- [ ] How-to guides for common tasks
- [ ] Troubleshooting common issues

### Developer-Facing (if applicable)

- [ ] API documentation (endpoints, params, responses)
- [ ] Configuration reference
- [ ] Integration guides

### Operational (if applicable)

- [ ] Deployment procedures
- [ ] Monitoring/alerting setup
- [ ] Runbook for common issues

### Scope Decision

For this release, we will document:

- [Priority 1 items]
- [Priority 2 items - if time permits]

Deferred to next iteration:

- [Lower priority items]
```

**For comprehensive documentation:**
Invoke: `{project-root}/_bmad/bmm/workflows/document-project/workflow.yaml`

**Documentation Principles:**

- Documentation is teaching - every doc helps someone accomplish a task
- Clarity above all
- Start with the user's goal, not the feature's capabilities
- Use examples liberally

### Step 4: Release & Deploy

**Lead:** Fulfillization Manager

"Time to ship! Let's make sure this goes smoothly."

**Release Preparation:**

```markdown
## Release Checklist

### Release Notes

Version: [version]
Date: [date]

#### What's New

- [Feature/improvement 1]
- [Feature/improvement 2]

#### Bug Fixes

- [Fix 1]
- [Fix 2]

#### Breaking Changes

- [Breaking change 1 + migration path]

#### Known Issues

- [Known issue 1]

### Deployment

- [ ] Deployment steps documented/automated
- [ ] Rollback plan ready
- [ ] Feature flags configured (if applicable)
- [ ] Monitoring verified

### Communication

- [ ] Stakeholders notified
- [ ] Users notified (if user-facing)
- [ ] Documentation published
```

### Step 5: Retrospective & Feedback Loop

**Lead:** Fulfillization Manager

"What did we learn that should inform future work?"

**Lightweight Retrospective:**

```markdown
## Triad Cycle Retrospective

### What Worked Well

- [Item 1]
- [Item 2]

### What Could Improve

- [Item 1]
- [Item 2]

### Insights for Strategy

(Feed back to Strategist Marketer for future cycles)

- [Market insight learned during implementation]
- [User behavior observed]
- [Technical constraint discovered]

### Process Improvements

- [Workflow adjustment for next cycle]
```

**For formal team retrospective:**
Invoke: `{project-root}/_bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml`

---

## FEEDBACK LOOP TO STRATEGY

```
┌─────────────────────────────────────────────────────────────┐
│                    FEEDBACK LOOP                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Fulfillization Manager ──UX insights──▶ Strategist Marketer │
│                                                             │
│  Learnings to feed back:                                    │
│  - User behavior observations                               │
│  - Feature adoption patterns                                │
│  - Support/documentation gaps                               │
│  - Technical constraints affecting product                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

After each ship cycle, the Fulfillization Manager should share insights with the Strategist Marketer to inform future strategy.

---

## WORKFLOW COMPLETION

When ship is complete, present cycle summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                     SHIP COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Release Summary:
- Version: [version]
- Features: [count] shipped
- Documentation: [status]
- Known Issues: [count]

Artifacts Created:
- [List created documents]

Feedback for Strategy:
- [Key insight 1]
- [Key insight 2]

Next Steps:
  → Start new discovery cycle with Strategist Marketer
  → Address deferred items
  → Monitor deployed features

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Congratulations! This Triad cycle is complete.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ARTIFACT COMPATIBILITY

All artifacts produced by this workflow are compatible with:

- Full BMM workflows (release notes, documentation)
- BMM-Triad workflows (feedback to triad-discovery)
- Standard documentation formats

---

## SUCCESS METRICS

- [ ] Implementation accepted from build
- [ ] User experience validated
- [ ] Essential documentation created
- [ ] Release executed successfully
- [ ] Retrospective insights captured
- [ ] Feedback shared with Strategist Marketer
