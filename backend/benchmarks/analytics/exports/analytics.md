# Capability Analytics Report

Generated: 2026-06-28T18:07:17.970Z
Registry: v1 @ 1.0.0

## Summary

| Metric | Value |
|--------|-------|
| Total Capabilities | 31 |
| ✅ Healthy | 15 |
| ⚠️  Weak | 0 |
| ❌ Critical | 16 |
| **Health Score** | **48%** |
| **Average Coverage** | **26%** |

## By Health


### ❌ Critical (16)

| Capability | Coverage | Coverage Score |
|------------|----------|---------------|
| LIGHT_DIRECTION | 0p / 0s | 0% |
| LIGHT_CONTROL | 0p / 0s | 0% |
| LIGHT_TRANSITION | 0p / 0s | 0% |
| CHARACTER_CONSISTENCY | 0p / 0s | 0% |
| CHARACTER_EMOTION | 0p / 0s | 0% |
| RENDER_SEQUENCE | 0p / 0s | 0% |
| ACTION_TIMING | 0p / 0s | 0% |
| TIMELINE_SYNC | 0p / 0s | 0% |
| PHYSICS_CONSTRAINT | 0p / 0s | 0% |
| PHYSICS_ENVIRONMENT | 0p / 0s | 0% |
| WORLD_STATE | 0p / 0s | 0% |
| STYLE_TRANSFER | 0p / 0s | 0% |
| EMOTION_ALIGNMENT | 0p / 0s | 0% |
| EMOTION_ARC | 0p / 0s | 0% |
| POST_COLOR_GRADING | 0p / 0s | 0% |
| POST_VFX | 0p / 0s | 0% |

### ✅ Healthy (15)

| Capability | Coverage | Coverage Score |
|------------|----------|---------------|
| CAMERA_PATH | 2p / 1s | 60% |
| CAMERA_MOTION | 1p / 1s | 40% |
| CAMERA_COMPOSITION | 1p / 6s | 100% |
| CAMERA_FOCUS | 1p / 0s | 20% |
| LIGHT_CONTINUITY | 1p / 0s | 20% |
| CHARACTER_REFERENCE | 2p / 0s | 40% |
| CHARACTER_POSE | 0p / 1s | 20% |
| RENDER_SHOT | 0p / 7s | 100% |
| RENDER_KEYFRAME | 0p / 2s | 40% |
| RENDER_MULTI_SHOT | 0p / 1s | 20% |
| TEMPORAL_CONSISTENCY | 1p / 5s | 100% |
| SHOT_TRANSITION | 2p / 1s | 60% |
| SPATIAL_LAYOUT | 0p / 6s | 100% |
| OBJECT_PERSISTENCE | 1p / 2s | 60% |
| SPATIAL_RELATIONSHIP | 1p / 1s | 40% |

## Detail

| Capability | Group | Stage | Difficulty | Pri | Sec | Coverage | Health |
|------------|-------|-------|------------|-----|-----|----------|--------|
| CAMERA_PATH | camera | planner | L2 | 2 | 1 | 60% | ✅ healthy |
| CAMERA_MOTION | camera | planner | L1 | 1 | 1 | 40% | ✅ healthy |
| CAMERA_COMPOSITION | camera | planner | L2 | 1 | 6 | 100% | ✅ healthy |
| CAMERA_FOCUS | camera | planner | L2 | 1 | 0 | 20% | ✅ healthy |
| LIGHT_DIRECTION | lighting | planner | L1 | 0 | 0 | 0% | ❌ critical |
| LIGHT_CONTINUITY | lighting | negotiator | L2 | 1 | 0 | 20% | ✅ healthy |
| LIGHT_CONTROL | lighting | planner | L2 | 0 | 0 | 0% | ❌ critical |
| LIGHT_TRANSITION | lighting | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| CHARACTER_REFERENCE | character | compiler | L0 | 2 | 0 | 40% | ✅ healthy |
| CHARACTER_CONSISTENCY | character | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| CHARACTER_EMOTION | character | planner | L1 | 0 | 0 | 0% | ❌ critical |
| CHARACTER_POSE | character | planner | L1 | 0 | 1 | 20% | ✅ healthy |
| RENDER_SHOT | render | renderer | L0 | 0 | 7 | 100% | ✅ healthy |
| RENDER_KEYFRAME | render | renderer | L0 | 0 | 2 | 40% | ✅ healthy |
| RENDER_SEQUENCE | render | renderer | L2 | 0 | 0 | 0% | ❌ critical |
| RENDER_MULTI_SHOT | render | renderer | L3 | 0 | 1 | 20% | ✅ healthy |
| TEMPORAL_CONSISTENCY | temporal | negotiator | L2 | 1 | 5 | 100% | ✅ healthy |
| ACTION_TIMING | temporal | planner | L2 | 0 | 0 | 0% | ❌ critical |
| SHOT_TRANSITION | temporal | planner | L1 | 2 | 1 | 60% | ✅ healthy |
| TIMELINE_SYNC | temporal | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| PHYSICS_CONSTRAINT | physics | renderer | L3 | 0 | 0 | 0% | ❌ critical |
| PHYSICS_ENVIRONMENT | physics | renderer | L3 | 0 | 0 | 0% | ❌ critical |
| SPATIAL_LAYOUT | spatial | planner | L0 | 0 | 6 | 100% | ✅ healthy |
| WORLD_STATE | spatial | negotiator | L2 | 0 | 0 | 0% | ❌ critical |
| OBJECT_PERSISTENCE | spatial | negotiator | L2 | 1 | 2 | 60% | ✅ healthy |
| SPATIAL_RELATIONSHIP | spatial | planner | L1 | 1 | 1 | 40% | ✅ healthy |
| STYLE_TRANSFER | style | renderer | L2 | 0 | 0 | 0% | ❌ critical |
| EMOTION_ALIGNMENT | emotion | planner | L2 | 0 | 0 | 0% | ❌ critical |
| EMOTION_ARC | emotion | planner | L3 | 0 | 0 | 0% | ❌ critical |
| POST_COLOR_GRADING | post | renderer | L2 | 0 | 0 | 0% | ❌ critical |
| POST_VFX | post | renderer | L2 | 0 | 0 | 0% | ❌ critical |
