# WORKBENCH-PERSISTENCE-ROUNDTRIP-REPORT.md

## Audit Date
2026-06-24

## Architecture Overview

```
User Edit
  ↓
saveToServer()
  ↓  PUT /api/v2/workbench/project/:id
  ↓  body: { projectName, projectDesc, script, executionResults }
Backend
  ↓  prisma.project.update()
Project Table
  ↓  name, description, script, executionResults (JSONB)
Backend
  ↓  GET /api/v2/workbench/project/:id
loadFromServer()
  ↓
Workbench UI
```

## 🔴 S-RISK: Memory-Only State (Lost on Refresh)

| Field | Status | Impact |
|-------|:-----:|--------|
| `workspace.segments[]` | ❌ Memory-only | Segment editing lost on refresh |
| `narrative.videoStyle` | ❌ Not restored from DB | Resets to default on reload |
| `narrative.aspectRatio` | ❌ Not restored from DB | Resets to default on reload |
| `narrative.styleLocked` | ❌ Not restored from DB | Resets to default on reload |

### Details

**segments[]** — Director runtime segment data.
- `saveToServer()` writes `executionResults.segments` to the DB (line 276)
- `loadFromServer()` does NOT read back `executionResults.segments`
- When loading, uses `rawSegments` from `aiVideoSegments` or `executionResults.videoSegments` (line 694)
- These are DIFFERENT data sources — `segments` vs `videoSegments`

**videoStyle/aspectRatio/styleLocked** — User's visual style preferences.
- `saveToServer()` writes them to `executionResults` (lines 277-279)
- `loadFromServer()` saves prevVS from current memory (line 316), not from DB
- On fresh page load, prevVS is the default '3d', not the saved value

## 🟠 A-RISK

| Field | Status | Impact |
|-------|:-----:|--------|
| `pipeline.*` | ⚠️ Not persisted | Stage completion status lost on refresh |
| `narrative.videoSegments[]` | ⚠️ JSON (no schema) | Data valid but no type safety |

## 🟡 B-RISK

| Field | Status | Impact |
|-------|:-----:|--------|
| `executionResults.*` (JSON fields) | ⚠️ No schema validation | Possible invalid data |
| `narrative.beats[]` | ⚠️ Dual source | Could diverge |

## Fixes Applied

### Fix 1: Restore videoStyle from executionResults in loadFromServer
- Added fallback to `p.executionResults?.videoStyle`, `p.executionResults?.aspectRatio`, `p.executionResults?.styleLocked`
- When loading, prefers saved value from DB over memory default

### Fix 2: Restore segments from executionResults
- Added fallback to `p.executionResults?.segments` when `aiVideoSegments` and `executionResults.videoSegments` are both empty
- Ensures Director segment edits survive page refresh

## Remaining Gaps (Not Fixed)

1. `pipeline.*` stage completion status — stored in `executionResults.pipelineCompletedStages` by `saveToServer()` but not restored by `loadFromServer()`. Requires adding restoration logic.

## Production Readiness Score

| Area | Score |
|------|:-----:|
| Script persistence | 10/10 ✅ |
| Narrative analysis | 9/10 ✅ |
| Segment runtime | 6/10 ⚠️ (was memory-only, now partially fixed) |
| Video style prefs | 7/10 ⚠️ (was reset on refresh, now fixed) |
| Pipeline state | 5/10 ❌ (not persisted) |
| Auto-save | 8/10 ✅ (save works, but load misses some fields) |

**Overall: 7.5/10** — Functional but has known data restoration gaps on refresh. Save path is correct (writes to executionResults JSONB), but load path doesn't read back all saved fields.
