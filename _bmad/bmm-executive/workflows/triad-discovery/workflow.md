---
name: triad-discovery
description: 'Strategy → Requirements: Lead by Strategist Marketer with Fulfillization Manager UX input'
author: 'BMad Triad'
lead_agent: strategist-marketer
supporting_agents: [fulfillization-manager]

# Critical variables from config
config_source: '{project-root}/_bmad/bmm-executive/config.yaml'
output_folder: '{config_source}:output_folder'
user_name: '{config_source}:user_name'
communication_language: '{config_source}:communication_language'
document_output_language: '{config_source}:document_output_language'
planning_artifacts: '{config_source}:planning_artifacts'
date: system-generated

# Workflow components
installed_path: '{project-root}/_bmad/bmm-executive/workflows/triad-discovery'
project_context: '**/project-context.md'

# Output artifacts
product_brief_output: '{planning_artifacts}/product-brief.md'
prd_output: '{planning_artifacts}/prd.md'
epics_output: '{planning_artifacts}/epics-and-stories.md'

standalone: true
---

# Triad Discovery Workflow

**Goal:** Transform an idea or problem into well-defined requirements ready for architecture and implementation.

**Lead Agent:** Strategist Marketer (Sage)
**Supporting:** Fulfillization Manager (Finn) - UX perspective

---

## WORKFLOW OVERVIEW

This workflow guides you through the Discovery phase of product development:

```
┌─────────────────────────────────────────────────────────────┐
│                    TRIAD DISCOVERY                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Idea Exploration                                   │
│  └── What problem? Who has it? Why solve it now?            │
│                                                             │
│  Step 2: Market Validation                                  │
│  └── Competition? Differentiation? User evidence?           │
│                                                             │
│  Step 3: Requirements Definition                            │
│  └── Core features? MVP scope? Success metrics?             │
│                                                             │
│  Step 4: UX Foundation (FM collaboration)                   │
│  └── User journeys? Key interactions? Experience goals?     │
│                                                             │
│  Step 5: Handoff Preparation                                │
│  └── PRD finalized? Ready for architecture?                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## EXECUTION INSTRUCTIONS

### Phase Recognition

When this workflow is invoked, assess what the user already has:

**Starting from scratch:**

- No existing documentation
- Begin at Step 1: Idea Exploration

**Has product brief:**

- Product brief exists
- Skip to Step 3: Requirements Definition

**Has PRD:**

- PRD exists but needs refinement or epic breakdown
- Skip to Step 5: Handoff Preparation

### Step 1: Idea Exploration

**Lead:** Strategist Marketer

"Let's explore your idea. I'm going to ask some probing questions to understand the opportunity space."

**Core Questions (ask sequentially, dig deeper on each):**

1. **The Problem:** "What problem are you solving? For whom?"
   - Push for specificity: "Can you describe a specific person experiencing this pain?"
   - Quantify if possible: "How often? How severe?"

2. **The Why Now:** "Why is this the right time to solve this?"
   - Market timing? Technology enabler? Competitive gap?

3. **The Solution Vision:** "What does success look like? Paint me the picture."
   - Don't let them describe features - keep it outcome-focused

4. **The Differentiation:** "Why you? Why this approach?"
   - What's the unfair advantage?

**Output:** Mental model of the opportunity (no document yet)

### Step 2: Market Validation

**Lead:** Strategist Marketer

"Now let's validate this opportunity against market reality."

**If user wants research:**

- Invoke BMM Research workflow: `{project-root}/_bmad/bmm/workflows/1-analysis/research/workflow.md`
- Types available: Market, Technical, Domain, Competitive

**If user wants to proceed with assumptions:**

- Document key assumptions explicitly
- Flag them as "UNVALIDATED" for later verification

**Key Validation Questions:**

1. **Competition:** "Who else is solving this? How?"
2. **Differentiation:** "What makes your approach different/better?"
3. **Evidence:** "What evidence do we have that users want this?"

**Output:** Validated (or flagged) assumptions about market fit

### Step 3: Requirements Definition

**Lead:** Strategist Marketer

"Time to crystallize requirements. What MUST be true for this to succeed?"

**Invoke Product Brief workflow if none exists:**
`{project-root}/_bmad/bmm/workflows/1-analysis/create-product-brief/workflow.md`

**Or invoke PRD workflow for detailed requirements:**
`{project-root}/_bmad/bmm/workflows/2-plan-workflows/prd/workflow.md`

**Key Outputs:**

- Clear problem statement
- Target user personas
- Core features (prioritized)
- Success metrics
- MVP scope boundaries

### Step 4: UX Foundation

**Lead:** Strategist Marketer with **Fulfillization Manager** input

"Before we hand off to architecture, let's ensure we understand the user experience vision."

**Bring in Fulfillization Manager perspective for:**

1. **User Journeys:** "Walk me through the critical user flows"
2. **Key Interactions:** "What are the make-or-break moments?"
3. **Experience Goals:** "How should users FEEL using this?"
4. **Accessibility Considerations:** "Any special needs we must address?"

**Optionally invoke UX Design workflow:**
`{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-ux-design/workflow.md`

**Output:** UX direction documented (even if lightweight)

### Step 5: Handoff Preparation

**Lead:** Strategist Marketer

"Let's prepare everything for the Technologist Architect."

**Handoff Checklist:**

```markdown
## Discovery → Build Handoff Checklist

### Required Artifacts

- [ ] PRD complete with:
  - [ ] Problem statement
  - [ ] Target users
  - [ ] Core requirements (prioritized)
  - [ ] Success metrics
  - [ ] MVP scope
- [ ] UX direction documented (can be lightweight)

### Quality Gates

- [ ] No ambiguous requirements (all specific & testable)
- [ ] Priorities clear (P0/P1/P2 or MoSCoW)
- [ ] Success metrics are measurable
- [ ] Out-of-scope clearly defined

### Handoff Statement

"The Strategist Marketer confirms these requirements are ready
for architectural review by the Technologist Architect."
```

**If creating epics/stories:**
Invoke: `{project-root}/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md`

---

## WORKFLOW COMPLETION

When discovery is complete, present handoff summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 DISCOVERY COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Artifacts Created:
- [List created documents]

Ready for: Triad Build (Architecture → Implementation)

To continue the full cycle:
  → Invoke Technologist Architect with [TB] Triad Build
  → Or invoke triad-full-cycle for automated orchestration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ARTIFACT COMPATIBILITY

All artifacts produced by this workflow are compatible with:

- Full BMM workflows (can graduate to full methodology)
- BMM-Triad workflows (triad-build, triad-ship)
- Standard PRD/Epic/Story formats

---

## SUCCESS METRICS

- [ ] Clear problem definition exists
- [ ] Target users identified and understood
- [ ] Requirements prioritized and scoped
- [ ] UX direction established
- [ ] Handoff checklist complete
- [ ] Technologist Architect has what they need to begin architecture
