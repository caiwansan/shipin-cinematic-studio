# SEMANTIC-FIELD-INVENTORY.md

## Agent Output Fields vs Store Expected Fields

| Agent Output Field | Store Expected Field | Status | Fix Applied |
|-------------------|-------------------|--------|:-----------:|
| `narrative` | `fullText` or `narrativePurpose` | ⚠️ Drift | ✅ `seg.narrative` added as fallback |
| `emotionalTone` | `emotionArc` | ⚠️ Drift | ✅ `seg.emotionalTone` added as fallback |
| `visualDesc` | `fullText` or `narrativePurpose` | ⚠️ Drift | ✅ via `seg.narrative` fallback |
| `cameraAngle` | `shotPattern` | ⚠️ Drift | ✅ `seg.cameraAngle` added in fallback path |
| `emotionArc` | `emotionArc` | ✅ Aligned |
| `shotPattern` | `shotPattern` | ✅ Aligned |
| `dialogue` | `dialogue` | ✅ Aligned |
| `imagePrompt` | `imagePrompt` | ✅ Aligned |
| `negativePrompt` | `negativePrompt` | ✅ Aligned |
| `duration` | `duration` | ✅ Aligned |
| `segmentId` | `segmentId` | ✅ Aligned |
| `title` | `title` | ✅ Aligned |
| `sortOrder` / `segmentNumber` | `sortOrder` | ✅ Aligned |

## Not Yet Checked

| Agent Output Field | Store Expected Field | Risk |
|-------------------|-------------------|:----:|
| `visualPrompt` | `imagePrompt` | Unknown |
| `scenePrompt` | `imagePrompt` | Unknown |
| `cameraShot` | `shotPattern` | Unknown |
| `cameraMovement` | `(not mapped)` | Unknown |
| `emotionIntensity` | `intensity` | Drift |
| `visualEffect` | `description` | Unknown |

## Summary

- **6 fields confirmed aligned** — no drift
- **5 fields had drift** — all now have fallbacks
- **6 fields unverified** — need audit to confirm alignment

The most common drift pattern: **Agent uses underscore_camelCase, Store expects camelCase**.

Example: `seg.emotionalTone` → `seg.emotionArc`, `seg.narrative` → `seg.fullText`

For all future mappings: fallback chain should be:

```
storeField = seg.storeFieldAlias || seg.agentFieldAlias || seg.narrative || ''
```
