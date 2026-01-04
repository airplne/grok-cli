# BMM-Triad Migration Guide

## When to Use Triad vs Full BMM

### Choose BMM-Triad When:

| Scenario                   | Why Triad Works                                            |
| -------------------------- | ---------------------------------------------------------- |
| **Solo developer**         | 3 agents is a simpler mental model to switch between       |
| **Small project**          | Less ceremony, faster iterations                           |
| **Quick prototype or MVP** | Rapid cycles without full methodology overhead             |
| **Learning BMAD**          | Easier to understand the triad before scaling to 16 agents |
| **Time-constrained**       | Fewer handoffs, faster decisions                           |

### Choose Full BMM When:

| Scenario                    | Why Full BMM Works                                                    |
| --------------------------- | --------------------------------------------------------------------- |
| **Team of 3+**              | Specialized agents match team role distribution                       |
| **Enterprise project**      | Full ceremony and audit trails needed                                 |
| **Complex domain**          | Need deep specialist expertise (test architecture, UX research, etc.) |
| **Regulatory requirements** | Need explicit separation of concerns                                  |
| **Long-running project**    | Benefits from specialized focus areas                                 |

---

## Artifact Compatibility

**All artifacts are compatible between Triad and Full BMM:**

| Artifact         | Created By | Consumable By |
| ---------------- | ---------- | ------------- |
| Product Brief    | Either     | Either        |
| PRD              | Either     | Either        |
| Architecture Doc | Either     | Either        |
| Tech Spec        | Either     | Either        |
| Epics/Stories    | Either     | Either        |
| Sprint Status    | Either     | Either        |
| UX Design        | Either     | Either        |

**This enables:**

- Starting with Triad, graduating to Full BMM
- Starting with Full BMM, simplifying to Triad
- Mixed usage within the same project (different features)

---

## Graduating from Triad to Full BMM

### When to Graduate

Signals that you may need Full BMM:

1. **Team growth** - More than 2-3 people working simultaneously
2. **Specialization needed** - Deep testing, security, or UX focus
3. **Complexity increase** - Multiple integrations, microservices
4. **Audit requirements** - Need clear separation of concerns
5. **Knowledge silos** - Team members need focused expertise

### How to Graduate

**Step 1: Install Full BMM alongside Triad**

Both modules can coexist in the same BMAD installation.

**Step 2: Map Current State**

| Triad Agent                   | Maps To Full BMM Agents                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Sage (Strategist Marketer)    | John (PM), Mary (Analyst), Victor (Innovation), Sophia (Storyteller)                      |
| Theo (Technologist Architect) | Winston (Architect), Amelia (Dev), Murat (TEA), Barry (Quick Flow)                        |
| Finn (Fulfillization Manager) | Bob (SM), Sally (UX), Paige (Tech Writer), Carson (Brainstorm), Caravaggio (Presentation) |

**Step 3: Introduce Specialists Gradually**

Don't switch all at once. Introduce specialists as needed:

1. First: Split Technologist Architect → Architect + Dev
2. Then: Add TEA for dedicated test architecture
3. Then: Split Strategist Marketer → PM + Analyst
4. Continue as needed...

**Step 4: Update Workflow References**

Change workflow invocations from Triad workflows to BMM equivalents:

| Triad Workflow  | BMM Equivalent                                                |
| --------------- | ------------------------------------------------------------- |
| triad-discovery | create-product-brief + create-prd + create-epics-and-stories  |
| triad-build     | create-architecture + create-tech-spec + quick-dev            |
| triad-ship      | sprint-planning + create-story + dev-story + document-project |

---

## Downshifting from Full BMM to Triad

### When to Downshift

Signals that Triad might be better:

1. **Team reduction** - Now solo or small team
2. **Simpler project** - Original complexity not needed
3. **Speed priority** - Need faster cycles
4. **Context overhead** - Too many agent personalities to manage

### How to Downshift

**Step 1: Install Triad (if not already)**

**Step 2: Consolidate Active Work**

Ensure current sprints/stories are completed before switching.

**Step 3: Map Specialists to Triad Agents**

Use the mapping table above in reverse.

**Step 4: Simplify Workflow**

Replace complex multi-agent workflows with Triad equivalents.

---

## Agent Persona Mapping (Detailed)

### Sage (Strategist Marketer)

**Inherits from:**

| BMM Agent            | Key Contribution                               | Communication Style        |
| -------------------- | ---------------------------------------------- | -------------------------- |
| John (PM)            | "WHY?" detective, ruthless prioritization      | Direct, data-sharp         |
| Mary (Analyst)       | Evidence-based research, requirement precision | Treasure-hunt excitement   |
| Victor (Innovation)  | Jobs-to-be-Done, Blue Ocean thinking           | Chess grandmaster gravitas |
| Sophia (Storyteller) | Narrative strategy, emotional resonance        | Bard-like, enrapturing     |

**Sage's Synthesis:** Investigative strategist who asks "WHY?" relentlessly, grounds decisions in market evidence, sees disruption opportunities, and crafts compelling narratives.

---

### Theo (Technologist Architect)

**Inherits from:**

| BMM Agent           | Key Contribution                                     | Communication Style        |
| ------------------- | ---------------------------------------------------- | -------------------------- |
| Winston (Architect) | System design, boring technology, scalability        | Calm, pragmatic            |
| Amelia (Dev)        | Code implementation, TDD, spec adherence             | Ultra-succinct, file paths |
| Murat (TEA)         | Test architecture, quality gates, risk-based testing | Risk calculations          |
| Barry (Quick Flow)  | Rapid execution, lean artifacts                      | Direct, tech slang         |

**Theo's Synthesis:** Pragmatic technical authority who balances architecture with implementation, applies judgment based on context (spike vs production), and champions boring technology that works.

---

### Finn (Fulfillization Manager)

**Inherits from:**

| BMM Agent                 | Key Contribution                          | Communication Style        |
| ------------------------- | ----------------------------------------- | -------------------------- |
| Bob (SM)                  | Sprint flow, story prep, precise handoffs | Crisp, checklist-driven    |
| Sally (UX)                | User needs, empathy-driven design         | Picture-painting, advocacy |
| Paige (Tech Writer)       | Documentation, clarity transformation     | Patient educator           |
| Carson (Brainstorm)       | Facilitation, psychological safety        | YES AND energy             |
| Caravaggio (Presentation) | Visual communication, information design  | Creative director flair    |

**Finn's Synthesis:** "Last mile" specialist who adapts communication style to context while maintaining coherent identity. Process work is crisp, UX work is empathetic, documentation is patient, facilitation is energetic.

---

## Workflow Equivalence Reference

| Goal                          | Triad Workflow         | BMM Workflows                                   |
| ----------------------------- | ---------------------- | ----------------------------------------------- |
| Define problem & requirements | triad-discovery        | create-product-brief, research, prd             |
| Design architecture           | triad-build (step 1)   | create-architecture                             |
| Create implementation plan    | triad-build (step 2)   | create-tech-spec, create-epics-and-stories      |
| Implement features            | triad-build (step 3-4) | quick-dev, dev-story                            |
| Quality assurance             | triad-build (step 4)   | code-review, testarch workflows                 |
| Delivery & docs               | triad-ship             | sprint-planning, create-story, document-project |
| Full end-to-end               | triad-full-cycle       | workflow-init + all above                       |

---

## FAQ

### Can I use both Triad and Full BMM in the same project?

Yes, but not recommended. Pick one methodology per project to maintain consistency. You CAN have both installed globally and use different ones for different projects.

### Do Triad agents have access to BMM knowledge files?

Yes. Triad agents can invoke BMM workflows (like TEA knowledge base) when needed. The triad is a simplification of agents, not a removal of capabilities.

### Is Triad just "BMM Lite"?

No. "Lite" implies watered-down. Triad is a different architecture that consolidates expertise into fewer agents. Each Triad agent is a senior generalist, not a junior version of specialists.

### Can I switch mid-project?

Yes, because artifacts are compatible. Complete your current sprint/feature, then switch methodology. Don't switch mid-sprint.
