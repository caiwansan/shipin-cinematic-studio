# Sprint-ShortDrama-01.9.2 — Storyboard Card Reality Fix

**Date:** 2026-07-31 16:54 CST
**Status:** COMPLETE ✅
**Priority:** P0 — 用户可见数据断裂

## 问题

用户打开 `https://aigc.fushtn.com/studio/v2` 分镜工作台，分镜卡片画面描述为空。
后端管道已建设（ProductionPreparation / QualityGate / ExecutionPlan），但数据未进入前端消费的 API。

## 根本原因

### 数据链断裂（三层）

```
DB 真实数据 (AiVideoSegment / AiSceneSpec)
  ↓ ❌ 断裂
API /api/aigc-spec/:projectId/load
  ↓ ❌ 字段不对
前端 StoryboardWorkspace.vue
  ↓ ❌ 空
用户看到 "暂无详细画面描述"
```

### 具体问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| `seg.imagePrompt` 不存在 | 🔴 高 | 前端硬编码字段，AiVideoSegment 无此 column |
| 前端自行拼字段 | 🟡 中 | 前端代替后端做数据构建 |
| `AiSceneSpec` 数据未桥接 | 🔴 高 | 场景有数据，但前端读不到 |
| 空值静默 | 🔴 高 | "暂无详细画面描述" 未提示用户实际状态 |

## 修改方案

### 后端 — 新增 Adapter

| 文件 | 动作 |
|------|------|
| `src/services/storyboard/storyboard-display-adapter.ts` | **新增** — 统一分镜展示数据源 |

**优先级链：** `AiVideoSegment > AiSceneSpec > StoryboardImage > empty warning`

### 后端 — 修改 Route

| 文件 | 动作 |
|------|------|
| `src/routes/aigc-spec-db.ts` | 修改 loadHandler |

**变化：**
- 使用 `loadStoryboardDisplay()` 替代直接 `AiVideoSegment.findMany()`
- 返回 `visualDescription` 统一字段
- 新增 `displaySource` 标识数据来源
- 新增 `characterNames` 数组

### 前端 — 修改 StoryboardWorkspace.vue

| 文件 | 动作 |
|------|------|
| `studio-v2/workspace/storyboard/StoryboardWorkspace.vue` | 修改 |

**变化：**
- 删除 `seg.imagePrompt` 读取（字段不存在）
- 使用 `seg.visualDescription` 统一字段
- 空值改为产品化提示

## API 响应变化

### 新增字段

```json
{
  "videoSegments": [
    {
      "visualDescription": "清晨，青云镇全景...",
      "characters": [],
      "source": "AiVideoSegment"
    }
  ],
  "displaySource": "AiVideoSegment",
  "characterNames": ["程序员小明", "投资人张总"]
}
```

### 旧项目桥接

```json
{
  "videoSegments": [
    {
      "segmentId": "s1",
      "title": "决定创业",
      "visualDescription": "⚠️ 场景描述待完善",
      "source": "AiSceneSpec"
    }
  ],
  "displaySource": "AiSceneSpec"
}
```

## 空数据产品化

| 场景 | 显示 |
|------|------|
| 有分镜但空描述 | ⚠️ 尚未生成画面描述 |
| 有场景但空描述 | ⚠️ 场景描述待完善 |
| 无分镜 | ⚠️ 尚未生成分镜数据，请先完成剧本分析 |

## Reality Test

### API 测试

| 项目 | 状态 | 证据 |
|------|------|------|
| 空项目 → AiSceneSpec 桥接 | ✅ PASS | 3 segments，source=AiSceneSpec |
| 有数据项目 → AiVideoSegment | ✅ PASS | 19 segments，visualDescription 有内容 |
| 空 scene description → warning | ✅ PASS | "⚠️ 场景描述待完善" |
| 有 scene description → 正常显示 | ✅ PASS | "产品发布会现场" |
| 角色数据 | ✅ PASS | 角色名正确返回 |

### 前端验证

| 检查项 | 状态 |
|--------|------|
| 模板不再使用 `seg.imagePrompt` | ✅ 已删除 |
| 模板使用 `seg.visualDescription` | ✅ 已替换 |
| 空值显示 "⚠️ 尚未生成画面描述" | ✅ 已修改 |
| 空项目显示 "⚠️ 尚未生成分镜数据" | ✅ 已修改 |
| 前端构建 | ✅ PASS |
| 页面 HTTP 200 | ✅ PASS |

## 保持不变

- ✅ AiSceneSpec.imagePrompt 字段（其他组件使用）
- ✅ AiCharacterSpec.imagePrompt 字段（其他组件使用）
- ✅ AiVideoSegment 全量重构（不在此范围）
- ❌ AI 自动补描述（后续 Sprint）
- ❌ Task 02.4 AI 导演循环（暂停）
