# BMM-EXECUTIVE Workflows

## Available Workflows in bmm-executive

**triad-build**
- Path: `_bmad/bmm-executive/workflows/triad-build/workflow.md`
- Architecture → Implementation: Lead by Technologist Architect with Strategist Marketer requirements clarity

**triad-discovery**
- Path: `_bmad/bmm-executive/workflows/triad-discovery/workflow.md`
- Strategy → Requirements: Lead by Strategist Marketer with Fulfillization Manager UX input

**triad-full-cycle**
- Path: `_bmad/bmm-executive/workflows/triad-full-cycle/workflow.md`
- End-to-end orchestration: Discovery → Build → Ship

**triad-ship**
- Path: `_bmad/bmm-executive/workflows/triad-ship/workflow.md`
- Testing → Delivery → Docs: Lead by Fulfillization Manager with Technologist Architect technical handoff


## Execution

When running any workflow:
1. LOAD {project-root}/_bmad/core/tasks/workflow.xml
2. Pass the workflow path as 'workflow-config' parameter
3. Follow workflow.xml instructions EXACTLY
4. Save outputs after EACH section

## Modes
- Normal: Full interaction
- #yolo: Skip optional steps
