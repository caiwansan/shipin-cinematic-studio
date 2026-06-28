# Capability Coverage Report

Generated: 2026-06-28T10:40:05.223Z
Registry: v1 @ 1.0.0

## Summary

| Metric | Value |
|--------|-------|
| Total Capabilities | 31 |
| Covered | 15 |
| Missing (P0) | 16 |
| Weak (P1) | 0 |
| Sparse (P2) | 0 |
| **Coverage Score** | **48%** |

## By Group

| Group | Total | Covered | Coverage |
|-------|-------|---------|----------|
| undefined | 31 | 15 | 48% |

## By Stage

- **compiler**: 1/1 (100%)
- **negotiator**: 3/7 (43%)
- **planner**: 8/14 (57%)
- **renderer**: 3/9 (33%)

## By Difficulty

- **L0**: 4/4 (100%)
- **L1**: 4/6 (67%)
- **L2**: 6/17 (35%)
- **L3**: 1/4 (25%)

## Gaps

Gap Report

Total gaps: 16

🔴 P0 — Critical (16)
Primary=0, Secondary=0 — must add datasets

- **LIGHT_DIRECTION**: Capability "LIGHT_DIRECTION" (Light Direction) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L1-lighting` with secondary: LIGHT_CONTINUITY, LIGHT_CONTROL, LIGHT_TRANSITION

- **LIGHT_CONTROL**: Capability "LIGHT_CONTROL" (Light Control) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-lighting` with secondary: LIGHT_DIRECTION, LIGHT_CONTINUITY, LIGHT_TRANSITION

- **LIGHT_TRANSITION**: Capability "LIGHT_TRANSITION" (Light Transition) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-lighting` with secondary: LIGHT_DIRECTION, LIGHT_CONTINUITY, LIGHT_CONTROL

- **CHARACTER_CONSISTENCY**: Capability "CHARACTER_CONSISTENCY" (Character Consistency) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-character` with secondary: CHARACTER_REFERENCE, CHARACTER_EMOTION, CHARACTER_POSE

- **CHARACTER_EMOTION**: Capability "CHARACTER_EMOTION" (Character Emotion) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L1-character` with secondary: CHARACTER_REFERENCE, CHARACTER_CONSISTENCY, CHARACTER_POSE

- **RENDER_SEQUENCE**: Capability "RENDER_SEQUENCE" (Render Sequence) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-render` with secondary: RENDER_SHOT, RENDER_KEYFRAME, RENDER_MULTI_SHOT

- **ACTION_TIMING**: Capability "ACTION_TIMING" (Action Timing) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-temporal` with secondary: TEMPORAL_CONSISTENCY, SHOT_TRANSITION, TIMELINE_SYNC

- **TIMELINE_SYNC**: Capability "TIMELINE_SYNC" (Timeline Sync) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-temporal` with secondary: TEMPORAL_CONSISTENCY, ACTION_TIMING, SHOT_TRANSITION

- **PHYSICS_CONSTRAINT**: Capability "PHYSICS_CONSTRAINT" (Physics Constraint) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L3-physics` with secondary: PHYSICS_ENVIRONMENT

- **PHYSICS_ENVIRONMENT**: Capability "PHYSICS_ENVIRONMENT" (Physics Environment) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L3-physics` with secondary: PHYSICS_CONSTRAINT

- **WORLD_STATE**: Capability "WORLD_STATE" (World State) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-spatial` with secondary: SPATIAL_LAYOUT, OBJECT_PERSISTENCE, SPATIAL_RELATIONSHIP

- **STYLE_TRANSFER**: Capability "STYLE_TRANSFER" (Style Transfer) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-style` with secondary: (none)

- **EMOTION_ALIGNMENT**: Capability "EMOTION_ALIGNMENT" (Emotion Alignment) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-emotion` with secondary: EMOTION_ARC

- **EMOTION_ARC**: Capability "EMOTION_ARC" (Emotion Arc) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L3-emotion` with secondary: EMOTION_ALIGNMENT

- **POST_COLOR_GRADING**: Capability "POST_COLOR_GRADING" (Post Color Grading) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-post` with secondary: POST_VFX

- **POST_VFX**: Capability "POST_VFX" (Post VFX) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.
  → Suggested: `L2-post` with secondary: POST_COLOR_GRADING

## Detail

| Capability | Stage | Difficulty | Primary | Secondary | Total | Status |
|------------|-------|------------|---------|-----------|-------|--------|
| CAMERA_PATH | planner | L2 | 2 | 1 | 3 | ✅ |
| CAMERA_MOTION | planner | L1 | 1 | 1 | 2 | ✅ |
| CAMERA_COMPOSITION | planner | L2 | 1 | 6 | 7 | ✅ |
| CAMERA_FOCUS | planner | L2 | 1 | 0 | 1 | ✅ |
| LIGHT_DIRECTION | planner | L1 | 0 | 0 | 0 | ❌ GAP |
| LIGHT_CONTINUITY | negotiator | L2 | 1 | 0 | 1 | ✅ |
| LIGHT_CONTROL | planner | L2 | 0 | 0 | 0 | ❌ GAP |
| LIGHT_TRANSITION | negotiator | L2 | 0 | 0 | 0 | ❌ GAP |
| CHARACTER_REFERENCE | compiler | L0 | 2 | 0 | 2 | ✅ |
| CHARACTER_CONSISTENCY | negotiator | L2 | 0 | 0 | 0 | ❌ GAP |
| CHARACTER_EMOTION | planner | L1 | 0 | 0 | 0 | ❌ GAP |
| CHARACTER_POSE | planner | L1 | 0 | 1 | 1 | ✅ |
| RENDER_SHOT | renderer | L0 | 0 | 7 | 7 | ✅ |
| RENDER_KEYFRAME | renderer | L0 | 0 | 2 | 2 | ✅ |
| RENDER_SEQUENCE | renderer | L2 | 0 | 0 | 0 | ❌ GAP |
| RENDER_MULTI_SHOT | renderer | L3 | 0 | 1 | 1 | ✅ |
| TEMPORAL_CONSISTENCY | negotiator | L2 | 1 | 5 | 6 | ✅ |
| ACTION_TIMING | planner | L2 | 0 | 0 | 0 | ❌ GAP |
| SHOT_TRANSITION | planner | L1 | 2 | 1 | 3 | ✅ |
| TIMELINE_SYNC | negotiator | L2 | 0 | 0 | 0 | ❌ GAP |
| PHYSICS_CONSTRAINT | renderer | L3 | 0 | 0 | 0 | ❌ GAP |
| PHYSICS_ENVIRONMENT | renderer | L3 | 0 | 0 | 0 | ❌ GAP |
| SPATIAL_LAYOUT | planner | L0 | 0 | 6 | 6 | ✅ |
| WORLD_STATE | negotiator | L2 | 0 | 0 | 0 | ❌ GAP |
| OBJECT_PERSISTENCE | negotiator | L2 | 1 | 2 | 3 | ✅ |
| SPATIAL_RELATIONSHIP | planner | L1 | 1 | 1 | 2 | ✅ |
| STYLE_TRANSFER | renderer | L2 | 0 | 0 | 0 | ❌ GAP |
| EMOTION_ALIGNMENT | planner | L2 | 0 | 0 | 0 | ❌ GAP |
| EMOTION_ARC | planner | L3 | 0 | 0 | 0 | ❌ GAP |
| POST_COLOR_GRADING | renderer | L2 | 0 | 0 | 0 | ❌ GAP |
| POST_VFX | renderer | L2 | 0 | 0 | 0 | ❌ GAP |
