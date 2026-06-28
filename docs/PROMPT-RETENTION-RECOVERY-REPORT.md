# PROMPT-RETENTION-RECOVERY-REPORT

## Fix Applied

### Phase B: Frontend Payload
**File**: `frontend/studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue`
**Change**: Added `characters[]` and `scenes[]` structured arrays to `generateCurrentVideo()` payload

**Characters** sent (6 fields per character):
- name, gender, age, clothing, appearance, imageUrl

**Scenes** sent (6 fields per scene):
- name, environment, lighting, mood, timeOfDay, imageUrl

**Previously**: 0 of these fields were transmitted.

### Phase C: Worker Prompt Builder
**File**: `backend/src/queue/worker-runtime.ts`
**Change**: Added `## [角色约束]` and `## [场景约束]` sections to final video prompt

Generated prompt structure:
```
视频总时长：8 秒
【剧情描述】
...
【对话】
...
【特效音效】
...
## [角色约束]
角色名：阿诚 | 性别：男 | 年龄：30岁 | 服装：深灰色卫衣 | 外貌：身材偏瘦...

⚠️ 角色约束优先级高于剧情描述。如果剧情描述中的角色外观与角色约束冲突，以角色约束为准。

## [场景约束]
场景名：深夜便利店外 | 环境：城市街道 | 光照：路灯暖黄+便利店冷白 | 氛围：压抑 | 时间：深夜

⚠️ 场景约束优先级高于剧情描述。

## 锁定视频风格
当前风格：【写实】
...
## 逐秒镜头脚本
...
```

## Retention Measurement

### Before Fix
| Category | Fields Available | Fields Transmitted | Retention |
|----------|:---:|:---:|:---:|
| Character | 6 | 0 | 0% |
| Scene | 6 | 0 | 0% |
| Storyboard | 7 | 4 (narrative, dialogue, effects, optimizedShots) | 57% |
| Director | 4 | 0 | 0% |
| **Overall** | **23** | **4** | **17%** |

### After Fix
| Category | Fields Available | Fields Transmitted | Retention |
|----------|:---:|:---:|:---:|
| Character | 6 | 6 | **100%** |
| Scene | 6 | 6 | **100%** |
| Storyboard | 7 | 4 | 57% |
| Director | 4 | 0 | 0% |
| **Overall** | **23** | **16** | **70%** |

### Agent Score
| Metric | Before | After |
|--------|:---:|:---:|
| Character Retention | 0% | **100%** |
| Scene Retention | 0% | **100%** |
| Storyboard Retention | 57% | 57% |
| Director Retention | 0% | 0% |
| Overall Retention | 17% | **70%** |
| Agent Effectiveness | 5/10 | **7/10** |

## Remaining Losses (Future Work)

| Field | Location | Why Missing |
|-------|----------|-------------|
| storyboard.shotType | Frontend | Not available in store for current segment |
| storyboard.camera | Frontend | Not extracted from narrative text |
| storyboard.emotion | Frontend | Not included in generateCurrentVideo payload |
| storyboard.composition | Frontend | Never captured during storyboard phase |
| director.* | Frontend | Director Runtime is frozen |

## Success Criteria Status

| Criterion | Target | Status |
|-----------|--------|--------|
| Character Retention > 80% | 80% | ✅ 100% |
| Scene Retention > 80% | 80% | ✅ 100% |
| Storyboard Retention > 80% | 80% | ❌ 57% |
| Director Retention > 80% | 80% | ❌ 0% (Frozen) |
| **Overall Retention** | **80%** | ❌ **70%** |
| **Agent Score** | **8/10** | ❌ **7/10** |

## UI/Pipeline/Sidebar Changes
None. All active freezes respected.
