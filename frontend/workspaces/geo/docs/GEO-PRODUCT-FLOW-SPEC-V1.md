# GEO Product Flow Spec v1.0

**Status**: Canonical
**Scope**: Discovery → Recommendation → Verification (post-Mission Control)
**Model**: Task-Driven Product Flow

## Overview

GEO Workspace is now defined as a **Task-Driven Product**, not a Data Dashboard.

Every page must answer three questions for the user:
1. **Where am I?** — current brand/project, current workflow stage
2. **What should I do now?** — a single primary action, never multiple equal choices
3. **What happens after I do it?** — the next page is predictable

## Page Models

### Discovery — Task Entry Point

**Role**: The page where the user starts their first GEO task.

**User enters Discovery when**:
- They clicked "Continue" from Mission Control (journey step: discovery)
- They navigated directly (but still have an active brand)

**The page must show**:
1. Current brand name and status (same header pattern as Mission Control)
2. Discovery results summary (problems found, severity, count)
3. One CTA: "Start Discovery" or "View Results → Recommendations"
4. If completed, link directly to next step (Recommendations)

**Anti-patterns**:
- ❌ Showing raw scan data without context
- ❌ Multiple equal CTAs ("Run Scan", "View History", "Compare", "Export")
- ❌ Empty state without guidance

---

### Recommendation — Decision Point

**Role**: The page where the user decides what to fix.

**User enters Recommendations when**:
- Discovery completed → auto-navigate or user clicks "View Recommendations"
- They have active recommendations from a previous scan

**The page must show**:
1. List of recommendations with:
   - Impact level (High/Medium/Low)
   - Effort estimate
   - Clear "Create Mission" action per recommendation
2. One primary CTA: "Create Mission from Top Recommendation"
3. If all recommendations are done: "All recommendations addressed. Move to Verification."

**Anti-patterns**:
- ❌ Showing recommendations as a technical report
- ❌ No clear mapping from recommendation → mission
- ❌ User has to manually note down what to do next

---

### Verification — Completion Gate

**Role**: The page where the user confirms work is done.

**User enters Verification when**:
- Mission completed → auto-ready
- They navigated directly and have a completed mission

**The page must show**:
1. What was verified (which mission/brand)
2. Verification status (Pass/Fail/In Progress)
3. Results summary
4. One CTA: "Accept Results" or "Return to Mission"

**Anti-patterns**:
- ❌ Verification as a technical report
- ❌ No clear "what happens next" after verification

---

## Flow Diagram (Updated)

```
Mission Control
    │
    ▼ (click "Continue")
Discovery (Task Entry)
    │
    ▼ (run scan → results ready)
Recommendation (Decision Point)
    │
    ▼ (create mission)
    │
    ├── Mission Control (track progress) ←── loop
    │
    ▼ (complete mission)
Verification (Completion Gate)
    │
    ▼ (accept results)
Mission Control (journey updated)
```

## UI Standards Across All Pages

### Header Pattern
Every page follows the same header structure:
```
[Back to Dashboard]  [Page Title]  [Current Brand: Acme]
```

### State Pattern
Every page must handle all 4 states:
1. **Loading** — skeleton or progress indicator
2. **Empty** — guidance (not just "no data")
3. **Error** — retry available, never blank
4. **Ready** — single CTA, clear next step

### CTA Pattern
- One primary CTA per page
- Secondary actions are clearly subordinate (smaller, less contrast)
- "Continue to X" format for flow transitions

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-07-04 | 1.0 | Initial — defines 3 page models + flow diagram + UI standards |
