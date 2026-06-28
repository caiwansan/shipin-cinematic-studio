# Narrative Runtime Constitution v1

**日期**: 2026-06-01
**状态**: 生效中
**适用范围**: 全系统（前端 / 后端 / Prompt / DB / Artifact）

---

## 1. 核心原则

### 1.1 Single Source of Truth

全系统只有**一套** Narrative 类型定义：

```
shared/runtime/narrative-schema.ts
```

所有层从该文件派生类型：

| 层         | 引用方式                              |
|------------|---------------------------------------|
| Shared     | 本文件                                |
| Backend    | `import { ... } from '../../../shared/runtime/narrative-schema'` |
| Frontend   | `import { ... } from 'shared/runtime/narrative-schema'`           |
| Prompt     | JSON Schema 字段名与此文件接口一致     |
| Artifact   | DB 独立表字段与此文件接口一致          |

**禁止**：
- 前端自定义 Breakdown 类型
- 后端单独定义 Narrative 类型
- runtime/index.ts 重复声明
- artifact-sync 自定义 payload 类型

### 1.2 Canonical Normalize

```
AI chaos (raw AI output)
    ↓
normalizeNarrativeSpec()    ← 统一字段名 / ID / nullable
    ↓
NarrativeProjectSnapshot    ← canonical runtime object
    ↓
validateCanonicalNarrative() ← 边界校验
    ↓
DB / Artifact / Frontend
```

**Normalize 宪法**：
1. normalize 后下游永远不接触 raw AI output
2. 禁止 `raw.xxx || []` 透传
3. 禁止 `executionResults.xxx` fallback
4. 禁止前端 `.find()` 回补字段
5. 禁止 `seg.id || seg.segmentId` 等运行时兼容

### 1.3 Artifact Ownership

| Artifact            | Owner                     | DB Table           |
|---------------------|---------------------------|---------------------|
| characters          | `snapshot.characters`     | `ai_character_specs` |
| scenes              | `snapshot.scenes`         | `ai_scene_specs`     |
| voices              | `snapshot.voices`         | `ai_voice_configs`   |
| props               | `snapshot.props`          | `ai_prop_specs`（待建）|
| videoSegments       | `snapshot.videoSegments`  | `ai_video_segments`  |
| emotionCurve        | `snapshot.emotionCurve`   | 无独立表（JSON）     |
| productionMetadata  | `snapshot.productionMetadata` | `ai_video_production` |

唯一写入源函数：`syncArtifactsFromSnapshot()`

### 1.4 ExecutionResults 降级

`executionResults` 仅允许：
- `debug` / `audit trace` / `raw provider output`
- `analyzeV2Data.normalized`（canonical snapshot 的 JSON 持久化）
- `analyzeV2Data.rawAiResponse`（原始 AI 响应，禁止前端消费）

**禁止**：
- 前端从 executionResults 回补 runtime 状态
- executionResults 作为真实数据源

---

## 2. 统一规范

### 2.1 ID 规范

- 全部使用 `string`
- 禁止 `string | number` 联合类型
- 格式：`{prefix}_{value}`
  - 角色: `char_001`、`char_uuid`
  - 场景: `scene_001`
  - 对话: `dlg_001`
  - 动作: `act_001`
  - 音色: `voice_001`
  - 道具: `prop_001`
  - 分段: `seg_001`
  - 节拍: `bt_001`
  - 帧: `frame_001`

### 2.2 Nullable 规范

- 禁止混用 `undefined` / `null` / `''` / `0`
- 统一使用 `null`
- 辅助函数：`toNull()`、`toNullStrict()`、`toNullArray()`

### 2.3 字段名规范

| 合法字段名          | 被禁止的别名               |
|---------------------|----------------------------|
| `characterName`     | `character`、`speaker`、`roleName` |
| `voiceType`         | `style`、`type`、`tone` (作为字段名) |
| `sceneName`         | `scene`                    |
| `dialogue`          | `content` (在对话上下文中)  |
| `action`            | `description` (在动作上下文中) |
| `second`            | `timeIndex` (在情绪曲线中)  |

---

## 3. 禁止模式（Forbidden Patterns）

### 3.1 ❌ Fallback Schema

```typescript
// 禁止
const rawScript = p.script || p.executionResults?.rawScript || ''
```

### 3.2 ❌ ExecutionResults 回补

```typescript
// 禁止
const v2Scenes = p.executionResults?.analyzeV2Data?.normalized?.scenes || []
```

### 3.3 ❌ Raw Output Passthrough

```typescript
// 禁止
return { voices: raw.voices || [] }
// 必须
return { voices: normalizeVoices(raw.voices) }
```

### 3.4 ❌ Union ID Types

```typescript
// 禁止
id: string | number
// 必须
id: string
```

### 3.5 ❌ 前端兼容 Normalize

```typescript
// 禁止
const frame = seg.timeline.find(t => t.second === second)
// 前端不负责兼容 normalized 数据
```

---

## 4. 迁移原则

1. 新数据走 canonical path
2. 不并行运行新旧 schema（单源宪法）
3. 逐步删除 legacy compatibility
4. `replace old system` + `delete legacy compatibility` + `single runtime constitution`

---

## 5. 校验

所有 canonical 数据流转前必须经过 `validateCanonicalNarrative()`。

校验规则：
- ID 类型检查（禁止 number）
- Required field 非空检查
- Unknown field rejection（warning）
- Nullable 一致性检查

---

## 6. 历史

| 日期       | 版本 | 变更                                     |
|------------|------|------------------------------------------|
| 2026-06-01 | v1   | Initial constitution after Phase 1-4 audit |
