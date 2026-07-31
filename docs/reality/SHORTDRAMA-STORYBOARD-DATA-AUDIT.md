# Sprint-ShortDrama-02 — Storyboard 数据审计报告

**Date:** 2026-07-31
**Author:** Reality Test Runner

---

## 审计范围

所有与分镜视觉描述相关的 DB 表。

## DB Schema 清单

### Storyboard (旧模型 — 未使用)

```prisma
model Storyboard {
  id              String   @id @default(uuid())
  projectId       String
  shotIndex       Int
  subject         String?
  action          String?
  cameraMovement  String?
  lens            String?
  lighting        String?
  emotion         String?
  environment     String?
  ...
}
```

**数据：0 条** — 旧系统使用的表，新链路未使用。

### AiSceneSpec (场景规格 — 当前使用)

```prisma
model AiSceneSpec {
  id             String   @id @default(uuid())
  projectId      String
  sceneId        String
  sceneName      String
  description    String?
  type           String?
  timeOfDay      String?
  lighting       String?
  mood           String?
  colorTone      String?
  environment    String?
  imagePrompt    String   @default("")    // ← 关键字段
  negativePrompt String?
  aspectRatio    String   @default("16:9")
  confirmed      Boolean  @default(false)
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### AiCharacterSpec (角色规格 — 当前使用)

```prisma
model AiCharacterSpec {
  id                  String   @id @default(uuid())
  projectId           String
  characterName       String
  physicalDescription String?
  clothing            String?
  imagePrompt         String   @default("")  // ← 关键字段
  negativePrompt      String?
  ...
}
```

### AiFrameDesign (帧设计 — 未使用)

```prisma
model AiFrameDesign {
  id               String   @id @default(uuid())
  projectId        String
  segmentId        String
  firstFrameDesc   String?
  firstFramePrompt String?
  firstFrameAngle  String?
  lastFrameDesc    String?
  lastFramePrompt  String?
  lastFrameAngle   String?
  ...
}
```

**数据：0 条**

---

## 数据缺失率

| 表 | 字段 | 总行数 | 缺失数 | 缺失率 |
|---|------|--------|--------|--------|
| **AiSceneSpec** | `imagePrompt` | 40 | 37 | **93%** |
| **AiSceneSpec** | `description` | 40 | 22 | **55%** |
| **AiSceneSpec** | `mood` | 40 | 39 | **98%** |
| **AiSceneSpec** | `timeOfDay` | 40 | 39 | **98%** |
| **AiSceneSpec** | `colorTone` | 40 | 39 | **98%** |
| **AiSceneSpec** | `type` | 40 | 40 | **100%** |
| **AiSceneSpec** | `lighting` | 40 | 17 | **43%** |
| **AiSceneSpec** | `environment` | 40 | 17 | **43%** |
| **AiCharacterSpec** | `imagePrompt` | 74 | 74 | **100%** |

---

## 样本数据

### 有空 imagePrompt 的场景（好）

```
project: 03107ec9
场景: 晨雾茶院 → "宏荼记铺子后院，青石板地面布满苔藓与落叶..."
```

### 有空 description 但无 imagePrompt 的场景（需要修复）

```
project: 6fb8d2d8
场景1: 光音相遇 → desc="光音在云霄间相遇，四周仙气缭绕" imgPrompt="(empty)"
场景3: 机械佛国 → desc="机械与佛法共存的未来佛国" imgPrompt="(empty)"
```

### 空场景

```
project: 14a5894a
场景1: 回忆庭院 → desc="(empty)" imgPrompt="(empty)"
场景2: 京城暗巷 → desc="(empty)" imgPrompt="(empty)"
```

---

## 根因分析

`artifact-sync.service.ts` 从 narrative output 写入 AiSceneSpec：

```typescript
// 写入场景
imagePrompt: s.imagePrompt || '',  // ← 如果 narrative 没有 imagePrompt → 写入空字符串
```

Narrative LLM 输出中包含：
- `scenes[].name` — 场景名 ✅
- `scenes[].description` — 描述 ❌ 部分缺失
- `scenes[].imagePrompt` — 图片 Prompt ❌ 几乎全缺失

narrative-llm.ts 有角色 Prompt 优化（`type === 'character'`），但：
1. 需要用户主动触发
2. 场景没有对应的 Prompt 优化入口

---

## 修复路线

### 已实施 (Task 01.6)

1. **StoryboardQualityGate**: 执行前门控验证，imagePrompt < 20 字符则 BLOCK
2. **LLM 补全引擎**: `fixSceneVisualDescription()` + `fixCharacterVisualDescription()`
3. **新路由**: `POST /api/director/execution/plan-from-specs` — 一站式从 DB 生成执行计划

### 建议后续

4. 在 narrative-llm.ts 的场景生成阶段直接输出 imagePrompt（减少后期补全依赖）
5. 添加 `VideoTask.promptSource` 字段（持久化 prompt 来源追踪）
6. 前端展示 specs-status 可视化面板
