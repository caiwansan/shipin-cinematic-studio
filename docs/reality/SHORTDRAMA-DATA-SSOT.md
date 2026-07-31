# SHORTDRAMA-DATA-SSOT — 短剧业务数据单一事实源定义

- Sprint: ShortDrama-Reality-Recovery-01 / Phase 1
- 日期: 2026-07-31
- 状态: ✅ SSOT 定义生效
- 验证方式: schema.prisma 字段级核对 + 运行时数据抽样

---

## 1. SSOT 定义（冻结）

| 业务实体 | SSOT（唯一事实源） | 表/位置 | 关键字段（已核对存在） |
|---------|-------------------|---------|----------------------|
| **角色** | `AiCharacterSpec` | ai_character_specs | characterName / variant / gender / age / role / voiceType / physicalDescription / clothing / imagePrompt / negativePrompt / referenceImageUrl / confirmed / sortOrder |
| **场景** | `AiSceneSpec` | ai_scene_specs | sceneId / sceneName / description / type / timeOfDay / lighting / mood / colorTone / environment / imagePrompt / negativePrompt / aspectRatio / confirmed / sortOrder |
| **分镜段落** | `AiVideoSegment` | ai_video_segments | segmentId / title / associatedScenes / duration / narrativePurpose / fullText / shotPattern / emotionArc / backgroundMusic / videoUrl / firstFrameUrl / midFrameUrl / lastFrameUrl / firstFrameDesc / midFrameDesc / lastFrameDesc / confirmed / sortOrder / narrative |
| **角色图** | `CharacterImage` | character_images | characterName / variant / imageUrl / sortOrder（@@unique[projectId, characterName, variant]） |
| **场景图** | `SceneImage` | scene_images | sceneName / imageUrl / sortOrder（@@unique[projectId, sceneName]） |
| **分镜图** | `StoryboardImage` | storyboard_images | segmentId / description / imageUrl / sortOrder（@@unique[projectId, segmentId]） |
| **道具图** | `PropImage` | prop_images | propName / category / description / imageUrl / imagePrompt / negativePrompt / referenceUrl |
| **视频结果** | `AiVideoSegment.videoUrl` | ai_video_segments.video_url | Worker 完成后回写（queue-manager.ts:231-240） |
| **用户编辑** | `executionResults.userEdits` | Project.executionResults JSON | 用户对段落的修改（narrative/dialogue/effects/emotion/prompt）统一存这里 |
| **阶段状态** | backend task completion → pipeline_stages | pipeline_stages | Phase 3 实现（Worker 完成任务写 stage） |

---

## 2. 写入方契约（谁可以写 SSOT）

### AiCharacterSpec / AiSceneSpec / AiVideoSegment（AI 分析事实）
- ✅ **唯一合法写入方**: 
  1. `script-submit` → `artifact-sync.service.ts`（AI 拆解结果落库）
  2. `aigc-spec-db.ts save`（用户确认规格保存）
- ❌ 禁止: 前端组件直接写；其它路由绕过上述两个服务写

### CharacterImage / SceneImage / StoryboardImage / PropImage（图片事实）
- ✅ **唯一合法写入方**:
  1. `workbench-project.ts` save-image（COS 上传 + 落库）
  2. `execution-images.ts`（旧链路，Phase 5 评估收敛）
- 图片 URL 必须是 COS 地址或可访问的本地下载地址

### AiVideoSegment.videoUrl（视频事实）
- ✅ **唯一合法写入方**: BullMQ Worker 完成回调（queue-manager.ts:204-240）
- ❌ 禁止: 前端传 URL 直接写；fake url

### executionResults.userEdits（用户编辑事实）
- ✅ **唯一合法写入方**: workbench-project PUT（saveToServer）
- 只存用户显式修改的字段，AI 分析结果不写这里

---

## 3. 读取方契约（前端只允许这样读）

```
前端读取分镜段落（唯一路径）:
  GET /api/v2/workbench/project/:id
    → aiVideoSegments（SSOT）
    → 用户编辑覆盖: 合并 executionResults.userEdits（按 segmentId）

前端读取角色/场景:
  GET /api/v2/workbench/project/:id
    → aiCharacterSpecs / aiSceneSpecs（SSOT）
    → 用户编辑覆盖: executionResults.userEdits（按 characterName/sceneId）

前端读取图片:
  GET /api/v2/workbench/project/:id
    → characterImages / sceneImages / storyboardImages / propImages
```

**禁止任何组件直接读取：**
- ❌ executionResults.segments / videoSegments / characterSpecs / sceneSpecs（原始业务数据 JSON —— 这是历史快照，不是 SSOT）
- ❌ store 缓存作为唯一数据源（刷新后必须能从 API 恢复）
- ❌ 不存在的字段（如 AiVideoSegment.imagePrompt —— model 无此字段）

---

## 4. 用户编辑层（executionResults.userEdits）设计

### 为什么
- 用户对 AI 结果的修改是**用户的创作事实**，与 AI 生成事实分离
- 重新 AI 分析时**不覆盖**用户编辑（解决 script-submit.ts:137 `delete merged.segments` 丢用户编辑的问题）

### 结构
```json
// Project.executionResults.userEdits
{
  "segments": {
    "seg_1": { "narrative": "...", "dialogue": "...", "emotion": "calm", "duration": 10 },
    "seg_2": { "fullText": "用户改写后的文本" }
  },
  "characters": {
    "李雷": { "imagePrompt": "用户改的提示词" }
  },
  "scenes": {
    "scene_1": { "imagePrompt": "..." }
  }
}
```

### 规则
- 合并优先级: userEdits > AI 表数据（读时按 key 覆盖）
- AI 重新分析: 清空表数据，**保留 userEdits**（用户编辑是用户资产）
- 用户主动"重置为 AI 结果" → 删除对应 userEdits key

---

## 5. 已识别违反 SSOT 的现状（Phase 2/3 修复清单）

| 违反点 | 现状 | 修复 |
|--------|------|------|
| 前端保存分镜文本到 `executionResults.segments` | 加载时优先读 aiVideoSegments，忽略 JSONB → **编辑刷新丢失**（运行时实测：宏荼记表 19 段 vs JSONB 13 段内容不同） | 前端保存改写 userEdits；加载时合并 |
| 前端加载 fallback 链读 executionResults.videoSegments/plotBlueprint | 与表数据可能不一致 | 删除 fallback，只读 SSOT |
| video-generation 用独立表 `/api/projects/segments/*`（ai_segment_edits） | 与 executionResults.segments 双轨 | 收敛到 userEdits + ai_video_segments |
| 角色页 prompt 本地态不落库 | 切角色/刷新丢失 | 写 AiCharacterSpec.imagePrompt 或 userEdits |
| ai_prop_specs 幽灵表 | 无 migration，写入必失败 | Phase 5 决策：删 model + include 移除（道具统一 prop_images） |
| Storyboard 表死表 | 字段与 model 脱节 | Phase 5 决策：归档 |
| ai_frame_designs 表 0 条 | 新表无人写 | Phase 5 决策：前端已用 storyboard_images，归档或启用 |
| 妆造图约定分裂 | worker 写 `名字_makeup`，store 期待 variant='makeup' | 统一 variant 约定 |

---

## 6. Reality Gate — Phase 1 SSOT 定义验证

| Gate | 要求 | 状态 |
|------|------|------|
| D1-1 | 每个 SSOT 实体有唯一表 + 已核对字段存在 | ✅ schema 核对完成 |
| D1-2 | 用户编辑与 AI 事实分离（userEdits 层） | ✅ 已定义 |
| D1-3 | 视频结果 SSOT = ai_video_segments.videoUrl（Worker 写） | ✅ queue-manager 确认 |
| D1-4 | 阶段状态 SSOT = pipeline_stages（后端写） | 📌 待 Phase 3 实现 |
| D1-5 | 禁止读取 executionResults 原始业务 JSON | ✅ 契约已定（前端 Phase 2 修） |
| D1-6 | 重新分析不丢用户编辑 | 📌 待实现（userEdits 保留策略） |

---

## 7. 待决策项（汇总自审计）

1. **ai_prop_specs**: 删 model + include 移除（推荐）vs 补 migration
2. **ai_segment_edits**: 与 executionResults.userEdits 合并（推荐 userEdits）vs 保留表
3. **Storyboard / VideoSegment / CharacterProfile / SceneProfile**: 归档 deprecated（推荐）
4. **ai_frame_designs**: 归档 vs 启用（前端已走 storyboard_images）

> 以上决策项均在 Phase 5（死代码治理）前确认，不阻塞 Phase 2/3/4/6。

---

*Phase 1 完成 | SSOT 定义生效 | 下一步: Phase 2 前端读取链收敛*
