# DIRECTOR-RUNTIME-EVALUATION

## Phase A: Field Inventory

| Director Output | Type | Description | Current Baseline Coverage |
|----------------|------|-------------|:------------------------:|
| `analyze().pacingScore` | Score | 0-100 pace evaluation | ❌ Not in prompt |
| `analyze().emotionClarity` | Score | 0-100 emotion clarity | ❌ Not in prompt |
| `analyze().continuousIssues` | Issues | Detected continuity problems | ❌ Not in prompt |
| `optimize().cameraPlans[]` | Plans | Per-second camera suggestions | ⚠️ Partial (via optimizedShots) |
| `optimize().emotionPlans[]` | Plans | Emotion progression per segment | ❌ Single tag only |
| `optimize().pacing.frameChanges[]` | Changes | Frame merge/split suggestions | ❌ Not in prompt |
| `decide()` | SegmentRuntime | Mutated segment clone | ❌ Risk area |
| `getGraphHints()` | GraphHints | Scene/emotion/camera scores + fixes | ❌ Not in prompt |
| `getGraphHints().emotionCurve` | Curve | Per-second emotion + intensity | ❌ Not in prompt |
| `getGraphHints().cameraFlow` | Flow | Camera transition recommendations | ❌ Not in prompt |

## Phase B: Impact Trace

```
Director Output          → Current Prompt Coverage     → Potential Delta
────────────────────────    ─────────────────────────      ──────────────
cameraPlans[]             → optimizedShots (per-sec)   → +1 (camera transitions)
emotionPlans[]            → single emotion tag          → +1 (emotion curve)
emotionCurve              → [镜头语言].emotion           → +1 (intensity)
pacing.frameChanges[]     → [镜头语言].duration          → +0 (already covered)
sceneFixSuggestions       → [场景约束]                   → +0 (already covered)
continuityIssues          → NOT IN PROMPT               → +3 (new capability)
decision                  → SegmentRuntime mutation     → RISK (data corruption)
```

**Potential Retention: ~50%** (6 of 12 Director fields would have marginal impact)

## Phase C: Shadow Compilation

**Current Prompt B (enhanced):**
```
## [角色约束] — 6 fields
## [场景约束] — 5 fields
## [镜头语言] — 3 fields (shotPattern, emotion, duration)
## 逐秒镜头脚本 — per-second camera/action/expression
## 锁定视频风格
## 参考图片
```

**With Director Runtime added:**
```
## [角色约束] — same
## [场景约束] — same
## [镜头语言] — +emotionCurve, +intensityProfile
## [运镜策略] — +transitionStrategy, +shotDiversity
## [连续性约束] — +continuityWarnings between segments
## 逐秒镜头脚本 — same (Director's cameraPlans overlap with existing)
## 锁定视频风格 — same
## 参考图片 — same
```

**Net new from Director:**
- `## [运镜策略]` section — +150 chars (8% prompt growth)
- `## [连续性约束]` section — +200 chars (11% prompt growth)
- Emotion intensity — +50 chars (3% prompt growth)

## Phase D: Expected Gain Analysis

| Criterion | B Score (current) | B+Director (estimated) | Delta |
|-----------|:----------------:|:---------------------:|:-----:|
| Character Consistency | 8/10 | 8/10 | 0 |
| Scene Consistency | 8/10 | 8/10 | 0 |
| Camera Compliance | 7/10 | 8/10 | **+1** |
| Emotion Accuracy | 6/10 | 7/10 | **+1** |
| Narrative Fidelity | 8/10 | 8/10 | 0 |
| Cross-Segment Continuity | 0/10 | 5/10 | **+5** |
| **Weighted Average** | **7.4/10** | **~8.0/10** | **+0.6 (+8%)** |

## Phase E: Risk Assessment

| Risk | Level | Description |
|------|:-----:|-------------|
| Runtime Complexity | 🟢 Low | 4 files, 578 lines, all frontend |
| Prompt Length Growth | 🟢 Low | +400 chars max (+22%) |
| LLM Cost Increase | 🟢 None | Director is a rule engine (no LLM calls) |
| Provider Compatibility | 🟢 None | No backend changes needed |
| Data Mutation via `decide()` | 🟡 **Medium** | Deep-copies and rewrites SegmentRuntime — could overwrite user edits |
| Duplication with existing system | 🟡 **Medium** | CameraPlans/EmotionPlans overlap with prompt-compiler.ts rules |
| Deployment | 🟢 Low | Frontend-only; requires nuxt build + pm2 restart |

## Decision

### RECOMMENDATION: KEEP FROZEN

**Key reasons:**
1. **Diminishing returns** — Director adds at most +0.6/10 (+8%) after the already-achieved +54% retention recovery
2. **Duplication** — Director's cameraPlans/emotionPlans overlap with existing `optimizedShots` per-second camera script
3. **Data mutation risk** — `decide()` deep-copies and rewrites SegmentRuntime, risk of overwriting user's storyboard edits
4. **Rule engine, not AI** — Already confirmed: DirectorAgent = rule engine (emotion→camera hardcoded mappings, same pattern as deleted `shot-prompt-compiler.ts`)

**If unfrozen anyway, the priority would be:**
1. Continuity warnings (biggest gap, 0/10 → 5/10)
2. Emotion curve (single tag → curve)
3. Camera transitions (new capability beyond per-second script)

**ROI Calculation:**
| Metric | Value |
|--------|:-----:|
| Current Agent Score | 8.5/10 |
| Expected Director gain | +0.3/10 |
| Effort (code + testing) | 3-5 days |
| Risk | Medium (data mutation) |
| ROI | **Low** |

**Final Verdict: Keep Frozen. Focus remaining resources on VideoGenerationWorkspace refactor and Voice Infrastructure.**
