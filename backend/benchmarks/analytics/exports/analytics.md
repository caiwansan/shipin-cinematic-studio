# Capability Analytics Report

Generated: 2026-06-28T06:54:04.340Z
Registry: v1 @ 1.0.0

## Summary

| Metric | Value |
|--------|-------|
| Total Capabilities | 31 |
| ✅ Healthy | 7 |
| ⚠️  Weak | 0 |
| ❌ Critical | 24 |
| **Health Score** | **23%** |
| **Average Coverage** | **7%** |

## By Health


### ❌ Critical (24)

| Capability | Coverage | Coverage Score |
|------------|----------|---------------|
| CAMERA_PATH | 0p / 0s | 0% |
| CAMERA_MOTION | 0p / 0s | 0% |
| CAMERA_FOCUS | 0p / 0s | 0% |
| LIGHT_DIRECTION | 0p / 0s | 0% |
| LIGHT_CONTINUITY | 0p / 0s | 0% |
| LIGHT_CONTROL | 0p / 0s | 0% |
| LIGHT_TRANSITION | 0p / 0s | 0% |
| CHARACTER_CONSISTENCY | 0p / 0s | 0% |
| CHARACTER_EMOTION | 0p / 0s | 0% |
| CHARACTER_POSE | 0p / 0s | 0% |
| RENDER_SEQUENCE | 0p / 0s | 0% |
| RENDER_MULTI_SHOT | 0p / 0s | 0% |
| ACTION_TIMING | 0p / 0s | 0% |
| TIMELINE_SYNC | 0p / 0s | 0% |
| PHYSICS_CONSTRAINT | 0p / 0s | 0% |
| PHYSICS_ENVIRONMENT | 0p / 0s | 0% |
| WORLD_STATE | 0p / 0s | 0% |
| OBJECT_PERSISTENCE | 0p / 0s | 0% |
| SPATIAL_RELATIONSHIP | 0p / 0s | 0% |
| STYLE_TRANSFER | 0p / 0s | 0% |
| EMOTION_ALIGNMENT | 0p / 0s | 0% |
| EMOTION_ARC | 0p / 0s | 0% |
| POST_COLOR_GRADING | 0p / 0s | 0% |
| POST_VFX | 0p / 0s | 0% |

### ✅ Healthy (7)

| Capability | Coverage | Coverage Score |
|------------|----------|---------------|
| CAMERA_COMPOSITION | 0p / 1s | 20% |
| CHARACTER_REFERENCE | 2p / 0s | 40% |
| RENDER_SHOT | 0p / 2s | 40% |
| RENDER_KEYFRAME | 0p / 2s | 40% |
| TEMPORAL_CONSISTENCY | 0p / 1s | 20% |
| SHOT_TRANSITION | 0p / 1s | 20% |
| SPATIAL_LAYOUT | 0p / 2s | 40% |

## Detail

| Capability | Group | Stage | Difficulty | Pri | Sec | Coverage | Health |
|------------|-------|-------|------------|-----|-----|----------|--------|
| CAMERA_PATH | camera | planner | L2 | 0 | 0 | 0% | ❌ critical |
| CAMERA_MOTION | camera | planner | L1 | 0 | 0 | 0% | ❌ critical |
| CAMERA_COMPOSITION | camera | planner | L2 | 0 | 1 | 20% | ✅ healthy |
| CAMERA_FOCUS | camera | planner | L2 | 0 | 0 | 0% | ❌ critical |
| LIGHT_DIRECTION | lighting | planner | L1 | 0 | 0 | 0% | ❌ critical |
| LIGHT_CONTINUITY | lighting | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| LIGHT_CONTROL | lighting | planner | L2 | 0 | 0 | 0% | ❌ critical |
| LIGHT_TRANSITION | lighting | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| CHARACTER_REFERENCE | character | compiler | L0 | 2 | 0 | 40% | ✅ healthy |
| CHARACTER_CONSISTENCY | character | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| CHARACTER_EMOTION | character | planner | L1 | 0 | 0 | 0% | ❌ critical |
| CHARACTER_POSE | character | planner | L1 | 0 | 0 | 0% | ❌ critical |
| RENDER_SHOT | render | renderer | L0 | 0 | 2 | 40% | ✅ healthy |
| RENDER_KEYFRAME | render | renderer | L0 | 0 | 2 | 40% | ✅ healthy |
| RENDER_SEQUENCE | render | renderer | L2 | 0 | 0 | 0% | ❌ critical |
| RENDER_MULTI_SHOT | render | renderer | L3 | 0 | 0 | 0% | ❌ critical |
| TEMPORAL_CONSISTENCY | temporal | negotiator | L2 | 0 | 1 | 20% | ✅ healthy |
| ACTION_TIMING | temporal | planner | L2 | 0 | 0 | 0% | ❌ critical |
| SHOT_TRANSITION | temporal | planner | L1 | 0 | 1 | 20% | ✅ healthy |
| TIMELINE_SYNC | temporal | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| PHYSICS_CONSTRAINT | physics | renderer | L3 | 0 | 0 | 0% | ❌ critical |
| PHYSICS_ENVIRONMENT | physics | renderer | L3 | 0 | 0 | 0% | ❌ critical |
| SPATIAL_LAYOUT | spatial | planner | L0 | 0 | 2 | 40% | ✅ healthy |
| WORLD_STATE | spatial | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| OBJECT_PERSISTENCE | spatial | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| SPATIAL_RELATIONSHIP | spatial | planner | L1 | 0 | 0 | 0% | ❌ critical |
| STYLE_TRANSFER | style | renderer | L2 | 0 | 0 | 0% | ❌ critical |
| EMOTION_ALIGNMENT | emotion | planner | L2 | 0 | 0 | 0% | ❌ critical |
| EMOTION_ARC | emotion | planner | L3 | 0 | 0 | 0% | ❌ critical |
| POST_COLOR_GRADING | post | renderer | L2 | 0 | 0 | 0% | ❌ critical |
| POST_VFX | post | renderer | L2 | 0 | 0 | 0% | ❌ critical |
