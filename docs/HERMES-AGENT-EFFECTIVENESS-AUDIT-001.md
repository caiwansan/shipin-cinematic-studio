# HERMES-AGENT-EFFECTIVENESS-AUDIT-001

## Audit Date
2026-06-24

## Effectiveness Score: 5/10

The system has comprehensive agent architecture, but over 50% of agent outputs never reach the final video generation model.

---

## PART A: Agent Inventory

| Agent | Location | Input | Output | Production Path |
|-------|----------|-------|--------|-----------------|
| 剧情总指挥 (Plot Supervisor) | `aigc-orchestrator.ts` | Script text | plotBlueprint | ✅ Called |
| 角色设计师 (Character Designer) | `aigc-orchestrator.ts` | Script + plotBlueprint | characterSpecs | ✅ Called |
| 场景设计师 (Scene Designer) | `aigc-orchestrator.ts` | Script + plotBlueprint | sceneSpecs | ✅ Called |
| 角色定妆师 (Makeup Designer) | `aigc-orchestrator.ts` | Script + characterSpecs | characterMakeupSpecs | ✅ Called |
| 声音设计师 (Sound Designer) | `aigc-orchestrator.ts` | Script + characterSpecs | voiceConfigs | ✅ Called |
| 画面设计师 (Frame Designer) | `aigc-orchestrator.ts` | Script + characterSpecs + sceneSpecs | frameDesign, videoSegments | **✅ KEY** |
| 道具设计师 (Props Designer) | `aigc-orchestrator.ts` | Script + characterSpecs + sceneSpecs | propSpecs | ✅ Called |
| 镜头/特效师 (DoP) | `aigc-orchestrator.ts` | Script + all prior outputs | effectSpecs | ✅ Called |
| Video Prompt Optimizer | `routes/ai-optimize-video-prompt.ts` | narrative + dialogue + effects | optimizedNarrative/dialogue/effects/frames | ✅ Called |
| Video Generation Worker | `queue/worker-runtime.ts` | narrative + dialogue + effects + shots + images | Video output | ✅ Called |
| Voice Agent | `routes/voice.ts` | character description | voiceId | ✅ Called (separate flow) |

### Ghost Agents (Declared but not in production video flow)

| Agent | Location | Why Ghost |
|-------|----------|-----------|
| DirectorAgent (frontend) | `DirectorAgent.ts` | Frozen. Not connected to pipeline. |
| SegmentToPromptCompiler | `SegmentToPromptCompiler.ts` | Only called by ExecutionEngine (also frozen) |
| ExecutionEngine | `ExecutionEngine.ts` | Only called by DirectorWorkspace (frozen) |
| decision-runtime/* agents | `decision-runtime/agents/*` | Experimental, not in production pipeline |
| shot-prompt-compiler | `shot-prompt-compiler.ts` | ✅ Already deleted (Part F1) |
| character.agent.ts | `agents/character.agent.ts` | 0 production references |
| cinematric-compiler/* | `cinematic-compiler/*` | 0 production references (experimental only) |

---

## PART B: Invocation Verification

| Agent | Called? | Output Used? | Details |
|-------|---------|-------------|---------|
| 剧情总指挥 | ✅ YES | ✅ YES | Output feeds subsequent agents |
| 角色设计师 | ✅ YES | ⚠️ PARTIAL | `characterSpecs` stored in DB but age/gender/clothing NEVER reach video prompt |
| 场景设计师 | ✅ YES | ⚠️ PARTIAL | `sceneSpecs` stored in DB but environment/weather/time NEVER reach video prompt |
| 角色定妆师 | ✅ YES | ❌ NO | `characterMakeupSpecs` only used for still image generation. Not in video prompt. |
| 声音设计师 | ✅ YES | ⚠️ PARTIAL | `voiceConfigs` only used for TTS (separate flow), NOT in video prompt |
| 画面设计师 | ✅ YES | ✅ YES | `frameDesign.videoSegments[].narrative` is the PRIMARY input to video prompt |
| 道具设计师 | ✅ YES | ❌ NO | `propSpecs` stored but never referenced in video generation prompt |
| 镜头/特效师 | ✅ YES | ⚠️ PARTIAL | `effectSpecs` stored, partially included via `effects` field |
| Video Prompt Optimizer | ✅ YES | ✅ YES | Rewrites narrative/dialogue/effects with cinematic language |
| Video Worker | ✅ YES | ✅ YES | Generates final video |

---

## PART C: Prompt Flow Audit

### Field Retention from Storyboard → Final Video Prompt

```
Storyboard fields available (8):
  narrative ✅ → enters final prompt
  dialogue  ✅ → enters final prompt
  effects   ✅ → enters final prompt
  shotType  ❌ → NOT in final prompt
  camera    ⚠️ → only if user manually enters in narrative text
  emotion   ❌ → NOT in final prompt
  duration  ✅ → enters final prompt
  characters ❌ → only as reference images, not as text descriptors
```

**Retention: 4/8 = 50%**
**Loss: 4/8 = 50%**

### Dropped Fields

| Field | Where Lost | Impact |
|-------|-----------|--------|
| shotType (景别) | Frontend → API boundary | Never sent to `/api/tasks/ai-generate` |
| camera (运镜) | Not extracted from narrative | Only present if user/text includes it in narrative |
| emotion (情绪) | Not in video generation payload | Only in edge loop, not in core path |
| characters (角色文本描述) | Replaced by image URLs | Character attributes (age/clothing/appearance) not in text prompt |

---

## PART D: Character Consistency Audit

| Field | In AiCharacterSpec? | In Video Prompt? | Notes |
|-------|-------------------|-----------------|-------|
| name | ✅ | ⚠️ Image refs only | Name NOT in text prompt |
| gender | ✅ | ❌ | Dropped |
| age | ✅ | ❌ | Dropped |
| appearance | ✅ | ❌ | Dropped |
| clothing | ✅ | ❌ | Dropped |
| personality | ❌ | ❌ | Never captured |
| imageUrl | ✅ | ✅ | Sent as `characterReferenceUrls` |

**Character fields in video prompt: 1/6 = 17%**
**Relies entirely on reference images, not text-based character grounding.**

---

## PART E: Scene Consistency Audit

| Field | In AiSceneSpec? | In Video Prompt? | Notes |
|-------|----------------|-----------------|-------|
| name | ✅ | ❌ | Not in prompt |
| description | ✅ | ⚠️ Indirectly | Only if narrative text contains it |
| environment | ✅ | ❌ | Dropped |
| lighting | ✅ | ❌ | Dropped |
| mood | ✅ | ❌ | Dropped |
| timeOfDay | ✅ | ❌ | Dropped |
| imageUrl | ✅ | ✅ | Sent as reference images |

**Scene fields in video prompt: 1/6 = 17%**
**Same as characters: relies on images, not text-based scene grounding.**

---

## PART F: Storyboard Utilization Audit

| Field | Available | In Final Prompt | Notes |
|-------|-----------|----------------|-------|
| shotType | ✅ | ❌ | Not extracted |
| camera | ✅ | ⚠️ Only if in narrative text | No structured field |
| action | ✅ | ⚠️ Only if in narrative text | |
| emotion | ✅ | ❌ | Not sent |
| duration | ✅ | ✅ | Sent to video model |
| dialogue | ✅ | ✅ | Sent directly |
| effects | ✅ | ✅ | Sent directly |

**Storyboard utilization: 3/7 = 43%**

---

## PART G: Provider Prompt Report

Example final prompt sent to video model (from worker-runtime.ts line 420-428):

```
视频总时长：8 秒
【剧情描述】
特写镜头缓慢推进，角色眼神低垂...
【对话】
阿诚：群里说老陈要调走了？
【特效音效】
环境音：远处车辆声...
## 锁定视频风格
当前风格：【写实】
风格特征：写实电影风格...
## 逐秒镜头脚本
【第0秒】运镜: 固定 | 动作: 低头看手机 | 表情: 眉头微皱
...

## 参考图片的画面描述
【首帧画面描述】
...
```

**Character constraints in prompt:** ❌ None (only image refs)
**Scene constraints in prompt:** ❌ None (only image refs)
**Camera constraints in prompt:** ⚠️ Via `optimizedShots` per-second script
**Continuity constraints in prompt:** ⚠️ Via `frameDescSection` frame references

---

## PART H: Ghost Agents

### Confirmed Ghost (0 production impact)

| Agent | Evidence |
|-------|----------|
| DirectorAgent (frontend) | Frozen in Architecture Freeze |
| SegmentToPromptCompiler | Not called by VideoGenerationWorkspace |
| ExecutionEngine | Only called by DirectorWorkspace |
| `character.agent.ts` | 0 production references |
| `cinematic-compiler/*` | Only experimental endpoint |

### Semi-Ghost (called but output discarded)

| Agent | Evidence |
|-------|----------|
| 角色定妆师 | Output stored in DB, never enters video prompt |
| 道具设计师 | Output stored in DB, never enters video prompt |
| 声音设计师 | Output used only for TTS, not video prompt |

---

## Top 10 Highest Impact Fixes

| Rank | Fix | Expected Impact | Effort |
|------|-----|----------------|--------|
| 1 | Add `characterSpecs` attributes (age/gender/clothing) to video prompt text | High - character grounding | Low |
| 2 | Add `sceneSpecs` attributes (environment/lighting/time) to video prompt text | High - scene grounding | Low |
| 3 | Add structured `camera` field from storyboard to video generation payload | Medium - camera control | Low |
| 4 | Add `shotType` to `optimizedShots` per-second script | Medium - shot diversity | Low |
| 5 | Add `emotion` field to video generation as mood guidance | Medium - emotional coherence | Low |
| 6 | Remove 道具设计师 from orchestrator (props never used) | Low - cleanup | Minimal |
| 7 | Remove 角色定妆师 output from orchestrator merge (makeup not in video) | Low - cleanup | Minimal |
| 8 | Remove `character.agent.ts` (0 production references) | Low - cleanup | Minimal |
| 9 | Pass `characterSpecs[].name` as text reference in video prompt | Medium - character ID | Low |
| 10 | Add continuity constraint text (`前一幕: X → 这一幕: Y`) | Medium - narrative flow | Medium |

---

## Summary

The video generation pipeline is effective at generating videos from `narrative + dialogue + effects + images`. However, **structured character/scene/storyboard fields** that the 8-agent orchestrator produces with significant effort are systematically **discarded** at the frontend → API boundary. The final prompt relies on free-text narrative and reference images, not structured attribute grounding.

This means the 8-agent architecture is **over-engineered for the current pipeline**: the agents produce rich structured data that the current video generation path cannot consume. The gap is at the **frontend `generateCurrentVideo()` function** which only extracts `narrative/dialogue/effects/optimizedShots` and discards everything else.
