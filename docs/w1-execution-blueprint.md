# Phase W1 Execution Blueprint

> 系统产品化拐点 — 2026-05-19  
> 目标：将 Director OS 包装为可运营的 AI 视频生产 SaaS  
> 核心原则：「架构分层隔离，概念词汇隔离」

---

## 目录

1. [Asset Canonical Schema](#1-asset-canonical-schema)
2. [Asset Version Protocol](#2-asset-version-protocol)
3. [Asset State Machine](#3-asset-state-machine)
4. [Continuity Protocol](#4-continuity-protocol)
5. [Card Contract](#5-card-contract)
6. [Optimization Protocol](#6-optimization-protocol)
7. [Unified AI Gateway Contract](#7-unified-ai-gateway-contract)
8. [Workflow UI Boundary](#8-workflow-ui-boundary)
9. [Migration Strategy](#9-migration-strategy)
10. [W1 Freeze Rule](#10-w1-freeze-rule)

---

## 1. Asset Canonical Schema（三层架构）

```
AssetCanonicalSchema（约束层 — 定义每种资产的"最小强制结构"）
    ↓  Agent 输出必须遵守
AssetRegistry（索引层 — 记录谁存在、什么状态、哪个版本）
    ↓  注册 + 索引
DB明细表（存储层 — 现有表承载实际数据）
```

### 1.1 核心原则

W1 的核心架构是**三层分离**，不是一层注册中心就够的。

- **Canonical Schema（约束层）**：规定每种 Asset 必须有哪些字段，Agent 输出格式的最低下限
- **Registry（索引层）**：谁存在、什么状态、什么版本
- **明细表（存储层）**：现有表不动，继续存详细数据

### 1.2 Canonical Asset Contract（新增约束层）

每种资产类型必须有**最小强制结构**，Agent 和前端都以此为准，超出部分自由扩展（open-ended），但不得少于这个结构。

```typescript
// ─── AssetCanonicalSchema ───

interface AssetCanonicalCharacter {
  id: string
  name: string
  appearance: string        // 外貌描述（强制）
  personality: string       // 性格描述（强制）
  background: string        // 背景设定
  relationship: string      // 关系描述
  imagePrompt: string       // 肖像 AIGC 提示词
  voiceDesign?: string      // 音色设计（可选）
}

interface AssetCanonicalScene {
  id: string
  name: string
  atmosphere: string        // 氛围（强制）
  visualStyle: string       // 视觉风格（强制）
  timeOfDay: string         // 时间段
  environment: string       // 环境描述
  imagePrompt: string       // 场景图 AIGC 提示词
}

interface AssetCanonicalStoryboard {
  id: string
  shotIndex: number
  description: string       // 分镜描述（强制）
  cameraMovement: string    // 运镜（强制）
  duration: string          // 时长
  lighting: string          // 光线
  emotion: string           // 情绪
  prompt: string            // AIGC 提示词
}

interface AssetCanonicalKeyframe {
  id: string
  segmentIndex: number
  type: 'head' | 'tail'    // 首帧或尾帧
  description: string       // 画面描述（强制）
  design: string            // 设计思路
  prompt: string            // AIGC 提示词
  inheritedFrom?: string    // 从上一段继承的 continuityLink id
}

interface AssetCanonicalShot {
  id: string
  sequenceIndex: number
  caption: string           // 镜头简述（强制）
  duration: string
  motionDesign: string      // 运镜设计（强制）
  visualDesign: string      // 视频段落设计
  soundDesign: string       // 特效音效设计
  dialogue: string          // 台词设计
  prompt: string            // AIGC 提示词
}
```

> **规则**：任何 Agent 输出必须符合对应 Canonical 接口的最小字段要求。前端渲染时以此为准，超出字段自动渲染为扩展信息。

### 1.3 当前资产表映射到 Canonical Schema

| 现有表 | Canonical Type | 覆盖度 |
|--------|---------------|-------|
| `AiCharacterSpec` / `CharacterProfile` | `AssetCanonicalCharacter` | 现有字段覆盖 80%，缺 imagePrompt 和 voiceDesign |
| `AiSceneSpec` / `SceneProfile` | `AssetCanonicalScene` | 现有字段覆盖 85%，缺 imagePrompt |
| `Storyboard` | `AssetCanonicalStoryboard` | 现有字段覆盖 90% |
| `AiFrameDesign` | `AssetCanonicalKeyframe` | 现有字段覆盖 75%，缺 inheritedFrom |
| `AiVideoSegment` | `AssetCanonicalShot` | 现有字段覆盖 80%，缺 soundDesign / dialogue |

**修复**：各 Agent Prompt 输出需要补全缺失的 Canonical 字段（在优化流程中自动补充，不在迁移脚本中处理）。

### 1.4 新增：AssetRegistry 表（资产注册中心）

不创建超大统一表，而是**注册中心模式**：为每个资产在 `AssetRegistry` 中注册一条记录，记录其 type、status、version，内容继续存在对应的明细表中。

```prisma
// 资产管理中心
model AssetRegistry {
  id              String   @id @default(uuid()) @db.Uuid
  projectId       String   @db.Uuid
  type            String                        // 'character' | 'scene' | 'prop' | 'storyboard' | 'keyframe' | 'shot'
  sourceId        String                        // 指向明细表的 id（如 AiCharacterSpec.id, Storyboard.id 等）
  status          String   @default("draft")    // draft | optimized | approved | generating | generated | failed | archived
  currentVersion  Int      @default(1)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, type, sourceId])
  @@index([projectId, type, status])
  @@map("AssetRegistry")
}
```

### 1.3 状态枚举

```typescript
type AssetStatus =
  | 'draft'       // AI 刚拆解
  | 'optimized'   // 已优化（用户或 Agent 触发）
  | 'approved'    // 用户确认
  | 'generating'  // 正在生成
  | 'generated'   // 已生成
  | 'failed'      // 生成失败
  | 'archived'    // 废弃/旧版本
```

### 1.4 迁移路径

- **新项目**：拆解完成后，自动为每个产出物注册 AssetRegistry 记录
- **旧项目**：一次性扫描脚本补充 AssetRegistry（见 Migration Strategy）

---

## 2. Asset Version Protocol

### 2.1 新增：AssetVersion 表

```prisma
model AssetVersion {
  id              String   @id @default(uuid()) @db.Uuid
  assetRegistryId String   @db.Uuid
  version         Int      @default(1)

  // 优化元信息
  optimizationType String?  // 'agent' | 'user_edit' | 'agent_batch'
  agent            String?   // 触发的 Agent 名称（如 'character-optimizer'）
  diffSummary      String?   // "外貌: 修改了发型描述; 性格: 新增了"果断"特质"

  // 内容快照（去规格化存储，确保版本独立可追溯）
  content          Json     // 该版本的完整内容快照
  prompt           Json?    // 对应的 AIGC 提示词快照

  createdAt        DateTime @default(now())

  asset            AssetRegistry @relation(fields: [assetRegistryId], references: [id], onDelete: Cascade)

  @@unique([assetRegistryId, version])
  @@index([assetRegistryId, createdAt])
  @@map("AssetVersion")
}
```

### 2.2 优化时序

```
用户点击"优化" → Agent 调用 AI → AI 返回优化结果
    ↓
创建 AssetVersion（version = currentVersion + 1）
    ↓
更新 AssetRegistry.currentVersion
    ↓
UI 渲染 "原始 vs 优化后" 对照表
    ↓
用户可以：
  a) 确认（approved）→ 该版本锁定为最终版
  b) 再次优化 → 创建新版本
  c) 回滚 → 修改 currentVersion 指向旧版本
```

### 2.3 回滚规则

- 回滚 = 将 `AssetRegistry.currentVersion` 指向旧版本号
- AssetVersion 永不被删除（保留审计链）
- 回滚后 UI 显示指定版本的快照内容

---

## 3. Asset State Machine

### 3.1 状态流转图

```
                    ┌─────────────┐
    AI 拆解 ──────→│    draft    │
                    └──────┬──────┘
                           │
                    用户点击优化 / Agent 优化
                           │
                           ↓
                    ┌──────────────┐
                    │  processing  │ ←── 新增：AI处理中态
                    └──────┬───────┘
                           │
                    AI 返回后
                           │
                     ┌─────┴──────┐
                     │            │
                     ↓            ↓
              ┌──────────┐  ┌──────────────┐
              │optimized │  │ partial_failed│ ←── 新增：局部失败态
              └─────┬────┘  └──────┬───────┘
                    │              │
              用户确认       用户部分确认 / 重试
                    │              │
                    ↓              ↓
              ┌──────────┐    ┌────────┐
              │ approved │    │  draft │
              └─────┬────┘    └────────┘
                    │
              开始生成（点击"生成"）
                    │
                    ↓
              ┌─────────────┐
              │  generating │ ←────── 可中断
              └──────┬──────┘
                     │
               ┌─────┴─────┐
               │           │
               ↓           ↓
        ┌──────────┐  ┌────────┐
        │generated │  │ failed │
        └────┬─────┘  └────┬───┘
             │             │
             │        用户重试
             │             │
             │        ┌─────┴───┐
             │        │         │
             │        ↓         ↓
             │    ┌────────┐  ┌──────────┐
             │    │ locked │  │  draft   │ ←── 新增：锁定态
             │    └────────┘  └──────────┘
             │
        用户归档
             │
             ↓
       ┌──────────┐
       │ archived │
       └──────────┘

重要补充：任何时候资产都可进入 locked（锁定态）
  - 其他 user/agent 正在操作该资产时
  - 生成中的资产不可被同时优化
  - 解除条件：当前操作完成或超时(30s)
```

### 3.2 状态控制规则

| 动作 | 触发者 | 前置状态 | 目标状态 | 说明 |
|------|-------|---------|---------|------|
| 拆解完成 | System | - | draft | AI 拆解完自动设置 |
| 优化（开始） | User/Agent | draft, optimized | processing | AI 调用中，UI 锁定 |
| 优化（成功） | System | processing | optimized | AI 返回 → 创建新版本 |
| 优化（完全失败） | System | processing | draft | AI 调用失败，保持原内容 |
| 优化（局部失败） | System | processing | partial_failed | 多维度优化中部分成功 |
| 确认 | User | optimized, partial_failed | approved | 用户确认内容可用 |
| 部分确认 | User | partial_failed | optimized | 接受成功部分，丢弃失败部分 |
| 锁定 | System | any | locked | 其他操作正在使用该资产 |
| 解锁 | System | locked | (原状态) | 操作完成或超时(30s) |
| 开始生成 | User | approved | generating | 调用 AI 执行视频生成 |
| 生成完成 | System | generating | generated | 异步回调 |
| 生成失败 | System | generating | failed | 保留错误信息 |
| 重试 | User | failed | draft | 重置到待处理 |
| 回滚 | User | any | optimized | 不改变状态，仅切换版本指针 |
| 归档 | User | generated | archived | 用户主动标记为已废弃 |

### 3.3 实现位置

- 状态变更通过 `AssetRegistry` 表的 `status` 字段实现
- 不引入复杂状态机库，使用 `prisma.update` + 条件检查
- 前端使用 Vue `computed` 派生按钮可用性

---

## 4. Continuity Protocol

### 4.1 连续性映射表

当前系统已有 `AiFrameDesign` 表记录首帧/尾帧设计。W1 新增 `ContinuityLink` 表来链接相邻段：

```prisma
model ContinuityLink {
  id           String   @id @default(uuid()) @db.Uuid
  projectId    String   @db.Uuid

  // 来源段（当前视频的尾帧）
  fromSegmentId String  @db.Uuid
  fromType      String                       // 'keyframe_tail' | 'scene_exit' | 'shot_end'

  // 目标段（下一个视频的首帧）
  toSegmentId   String   @db.Uuid
  toType        String                       // 'keyframe_head' | 'scene_enter' | 'shot_start'

  // 连续性类型
  linkType      String   @default("next_scene")  // next_scene | same_character | same_environment | same_camera

  // 继承内容（如果首尾帧相同则存储一份，避免重复生成）
  inheritedContent Json?

  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())

  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, fromSegmentId])
  @@map("ContinuityLink")
}
```

### 4.2 自动串联规则

```
视频分段顺序: segment[0] → segment[1] → segment[2] → ...

规则:
  1. segment[i].lastFrame → ContinuityLink → segment[i+1].firstFrame
  2. 用户修改 segment[i].lastFrame → 自动更新 ContinuityLink
  3. 如果 segment[i] 和 segment[i+1] 在同一场景 → linkType = 'same_environment'
  4. 如果 segment[i] 和 segment[i+1] 同角色 → linkType = 'same_character'
  5. Segment 新增/删除时，自动重建对应 ContinuityLink

用户可见:
  - 自动串联的首帧给标记 "(继承自视频 N 尾帧)"
  - 用户可以手动解除串联（改为独立首帧）
  - 解除后 ContinuityLink 标记为 manual 状态
```

### 4.3 与 wan2.7-i2v 的关系

阿里百炼 wan2.7-i2v 支持 `image_url`（首帧）和 `second_image_url`（尾帧控制）。

ContinuityLink 的流程：
1. segment[i] 生成后，保存其尾帧图 URL
2. 构建 segment[i+1] 时，从 ContinuityLink 读取尾帧 URL
3. 调用 wan2.7-i2v 时，将此 URL 作为 `image_url`（首帧）
4. 如果 segment[i+1] 也有自己的尾帧要求，同时传 `second_image_url`

---

## 5. Card Contract

### 5.1 卡片统一协议

所有工作台卡片遵守相同的接口协议：

```typescript
// 卡片元数据
interface CardMeta {
  type: 'character' | 'scene' | 'storyboard' | 'keyframe' | 'shot' | 'prop'
  title: string
  subtitle?: string
  assetRegistryId: string
  status: AssetStatus
  currentVersion: number
  versionCount: number
  createdAt: string
  updatedAt: string
}

// 卡片数据（从对应明细表 + AssetVersion.content 联合产出）
interface CardData {
  meta: CardMeta
  content: Record<string, any>  // 当前版本的内容快照
  displayFields: CardField[]    // 要在卡片上显示的字段列表
}

// 卡片字段定义（控制渲染方式）
interface CardField {
  key: string
  label: string
  type: 'text' | 'image' | 'select' | 'tags' | 'textarea'
  value: any
  editable: boolean
}

// 优化结果（用于对照表渲染）
interface CardOptimizationResult {
  assetRegistryId: string
  version: number
  agent: string
  diffSummary: string
  comparisons: FieldComparison[]
}

interface FieldComparison {
  key: string
  label: string
  originalValue: any
  optimizedValue: any
  originalPrompt?: string
  optimizedPrompt?: string
}
```

### 5.2 前端组件结构

```
<CardShell>                    ← 通用卡片容器（状态标签 + 版本号 + 操作按钮）
  <CardContent>                ← 通用内容渲染（根据 CardField.type 渲染）
  <OptimizationModal>          ← 优化对照表 Modal（CardOptimizationResult）
  <VersionHistory>             ← 版本历史列表（可选择回滚）
</CardShell>
```

### 5.3 当前卡片改造清单

| 现组件 | 需要改动 | 工作量 |
|--------|---------|-------|
| `CharacterDesignPanel.vue` | 包一层 CardShell + 加"优化"按钮 + 对照表 | 中 |
| `SceneDesignPanel.vue` | 同上 | 中 |
| `StoryboardPanel.vue` | 同上 + 加 continuity link 指示器 | 中 |
| `FrameDesignPanel.vue` | 同样改造 + 首尾帧指示器 | 中 |
| `VoiceDesignPanel.vue` | 同样改造 | 低 |

---

## 6. Optimization Protocol

### 6.1 优化 Agent 标准接口

```typescript
interface OptimizeRequest {
  assetRegistryId: string
  type: AssetType
  content: Record<string, any>   // 当前版本内容
  context: {
    projectId: string
    userId: string
    provider: string              // 'aliyun' | 'volcengine' | ...
    modelName: string             // 用户选的模型名
  }
  additionalContext?: string       // 用户补充的优化指示
}

interface OptimizeResponse {
  success: boolean
  result: {
    optimizedContent: Record<string, any>
    optimizedPrompt: Record<string, any>
    diffSummary: string
    agent: string
  }
  error?: string
}
```

### 6.2 现有 Agent 映射

| 卡片类型 | 当前 Prompt 文件 | Agent 名称 |
|---------|-----------------|-----------|
| character | `character-designer.txt` | character-optimizer |
| scene | `scene-designer.txt` | scene-optimizer |
| storyboard | `director-of-photography.txt` | storyboard-optimizer |
| keyframe/frame | `frame-designer.txt` | frame-optimizer |
| shot | `director-of-photography.txt` | shot-optimizer |
| prop | `props-designer.txt` | prop-optimizer |
| voice/sound | `sound-designer.txt` | sound-optimizer |

### 6.3 统一 Prompt 后缀模板

所有优化 Agent 的 Prompt 在现有内容后追加标准模板：

```
你正在优化{类型}设计。
当前版本内容：
{content}

请从以下维度进行优化：
1. 细节丰富度（增加视觉/叙事细节）
2. 一致性（确保与上下文匹配）
3. 可执行性（提高 AI 生成质量）

返回格式：
{
  "optimizedContent": { ... },    // 优化后的内容
  "optimizedPrompt": { ... },     // 优化后的 AIGC 提示词
  "diffSummary": "..."            // 修改摘要（中文）
}
```

### 6.4 优化流程

```
用户点击"优化"按钮
    ↓
前端 POST /api/workflow/optimize
    ↓
后端：
  1. 查 AssetRegistry → 获取 sourceId + type
  2. 查明细表 → 获取当前内容
  3. 查 UserModelConfig → 获取用户 API Key + 模型
  4. 调用 withUserModelConfig()
  5. 读取对应 Agent Prompt
  6. 调用 AI Gateway
  7. 解析返回 → 创建 AssetVersion
  8. 更新 AssetRegistry.currentVersion
    ↓
前端轮询/SSE 获取结果
    ↓
渲染"原始 vs 优化后"对照表
```

---

## 7. Unified AI Gateway Contract

### 7.1 Gateway 统一入口

不重构现有 adapter，只新增一层封装函数在 `src/runtime/ai-gateway.ts`。

核心设计是 **AIInvocationEnvelope（执行上下文信封）**，所有 AI 调用必须携带此信封，以实现链路追踪、审计、版本关联。

```typescript
// runtime/ai-gateway.ts — 统一 AI 调用网关

type Capability = 'llm' | 'image' | 'video' | 'tts' | 'asr'

// ─── AIInvocationEnvelope（执行上下文信封） ───
// 所有 AI 调用必须携带此信封，用于链路追踪、日志审计、版本关联
interface AIInvocationEnvelope {
  // 链路追踪
  traceId: string                    // 全局 Trace ID（每次操作生成）
  parentInvocationId?: string        // 父调用 ID（用于 Agent 链路追踪）

  // 身份
  userId: string
  projectId?: string
  assetRegistryId?: string           // 关联的资产（如果有）

  // 执行上下文
  agentType: string                  // 触发 Agent 名称
  operationType: string              // 'optimize' | 'generate' | 'analyze' | 'parse'

  // 模型
  capability: Capability
  provider: string
  model: string
}

interface InvokeParams {
  envelope: AIInvocationEnvelope
  payload: Record<string, any>
  options?: {
    timeout?: number
    retryCount?: number
    maxTokens?: number
    temperature?: number
  }
}

interface InvokeResult {
  success: boolean
  data: any
  usage?: {
    totalTokens?: number
    promptTokens?: number
    completionTokens?: number
  }
  latencyMs: number
  error?: string
  envelope: AIInvocationEnvelope     // 原信封返回，用于串联
}

async function invokeAI(params: InvokeParams): Promise<InvokeResult> {
  // 1. 生成 traceId（如果未传入）
  // 2. 查 UserModelConfig → 获取用户 Key + 选择模型
  // 3. 限流检查（per user per minute）
  // 4. 注入 Key 到 process.env
  // 5. 记录 InvocationLog（审计）
  // 6. 分发到对应 provider adapter
  // 7. 记录结果到 InvocationLog
  // 8. 恢复 Key
  // 9. 返回结果 + 完整 envelope
}
```

### 7.2 当前 Adapter 映射

| Capability | 现有 Adapter | 示例模型 |
|-----------|-------------|---------|
| llm | `aliyun-llm.provider.ts` / `narrative-gateway` | qwen3.6-max-preview |
| image | `aliyun-image.provider.ts` | wan2.7-image-pro |
| video | `aliyun-video.provider.ts` | wan2.7-t2v / wan2.7-i2v |
| tts | `aliyun-tts.provider.ts` | cosyvoice-v3.5-plus |
| asr | (已有 aliyun_asr 配置) | paraformer-realtime-v2 |

### 7.3 新增：InvocationLog（审计日志）

```prisma
model InvocationLog {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  projectId   String?
  capability  String   // llm | image | video | tts
  provider    String?  // aliyun | volcengine | deepseek
  model       String
  status      String   // success | failed | timeout
  latencyMs   Int?
  tokenUsage  Int?
  errorMsg    String?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([projectId, capability])
  @@map("InvocationLog")
}
```

---

## 8. Workflow UI Boundary

### 8.1 产品词汇隔离

```
✅ 用户层允许出现的词汇：
  项目 / 剧本 / 角色 / 场景 / 道具 / 分镜 / 视频 / 镜头
  首帧 / 尾帧 / 连续性 / 优化 / 确认 / 生成 / 导出
  版本 / 回滚 / 对比

❌ 用户层禁止出现的词汇：
  Director / Director OS / Showrunner / Cognitive / Simulation
  Runtime / Field Theory / Semantic / Recursive / Evolution
  Orchestrator / Gateway / Adapter / Pipeline / Job Queue
  认知 / 仿真 / 导演 / 运行时 / 场论 / 语义
```

### 8.2 工作台 vs Director OS 边界

```
用户工作台（Frontend SaaS）            Director OS（Hidden Layer）
─────────────────                    ─────────────────
  ProjectManager.vue                 Showrunner Core
  CharacterDesignPanel.vue           Cognition Loop
  SceneDesignPanel.vue               Simulation Layer
  StoryboardPanel.vue                Director Field Theory
  FrameDesignPanel.vue               Multi-Graph Scheduler
  VoiceDesignPanel.vue               Execution Graph
  ProductionTimeline.vue             Runtime Intelligence
  ModelSettingsModal.vue

  （新）OptimizationModal.vue
  （新）VersionHistory.vue
  （新）ContinuityIndicator.vue
```

### 8.3 UI 改造原则

1. **保留现有卡片组件**（CharacterDesignPanel 等），只在顶部加 `CardShell`
2. **不删除 Director OS 概念**，只是 UI 层不暴露
3. **设置页路由独立**（/settings/models），不嵌入工作台
4. **顶部系统栏简化**：去掉认知层指标，只保留项目状态

---

## 9. Migration Strategy

### 9.1 旧数据兼容

现有系统已有数据，迁移分两步：

#### Phase 9a — AssetRegistry 填充（一次性脚本）

```typescript
// scripts/migrate-asset-registry.ts
// 对每个已有项目：
//   1. 遍历 AiCharacterSpec → 注册 type='character'
//   2. 遍历 AiSceneSpec → 注册 type='scene'
//   3. 遍历 Storyboard → 注册 type='storyboard'
//   4. 遍历 AiFrameDesign → 注册 type='keyframe'
//   5. 遍历 AiVideoSegment → 注册 type='shot'
//   6. status 统一设为 'draft'
//   7. currentVersion = 1
```

#### Phase 9b — AssetVersion 初始快照（一次性脚本）

```typescript
// scripts/migrate-asset-versions.ts
// 对每个 AssetRegistry 记录：
//   1. 从对应明细表读取完整内容
//   2. 创建 AssetVersion(version=1, content=完整快照)
```

### 9.2 Dual Write Window（双写窗口期）

W1 迁移最重要的安全机制是**双写窗口**。在过渡期内，旧逻辑和新逻辑同时写数据，校验一致后再逐步切流。

```
Phase W1a — 注册扫描（只读，不写）
  → 运行脚本，扫描所有旧项目，创建 AssetRegistry 记录
  → 验证：每个旧表记录对应 1 条 AssetRegistry 记录
  → 人工复查：registry count == 旧表记录数

Phase W1b — 版本初始化（第一次写）
  → 为每个 AssetRegistry 创建 AssetVersion(1, content=旧表内容快照)
  → 验证：version count == registry count
  → 对比：version.content == 旧表内容

Phase W1c — 双写开启
  → 所有"优化"操作：新系统写 AssetVersion + 旧表内容同步更新
  → 校验：每次优化后 assetVersion.content == 旧表对应行
  → 如果校验失败 → 报警 + 自动回退（不抛用户错误）

Phase W1d — 切流
  → 确认双写一致率 > 99.9%（连续运行 72h）
  → 前端开始从 AssetVersion 读取（可切换开关）
  → 旧表降级为只读历史数据
```

### 9.3 新旧共存策略

- **旧项目**：迁移完 AssetRegistry 后，卡片仍然从旧表读取内容。优化时双写。
- **新项目**：拆解时直接写入明细表 + 注册 AssetRegistry + 创建 AssetVersion(1)
- **优化流程**：只在有 AssetRegistry 记录的资产上工作
- **过渡期**：旧表不变，新表做版本管理索引

### 9.3 前端兼容

- 现有 `store.directorRuntime` 继续使用（不做大改）
- 新卡片的 `CardShell` 检查：如果有 AssetRegistry → 显示版本/状态信息；没有 → 降级为旧模式
- 前端通过 `GET /api/workflow/asset-registry/:projectId` 批量获取注册信息

### 9.4 回退方案

如果 AssetRegistry 在运行中出现问题：
1. `AssetRegistry` 表是辅助索引，不含源数据
2. 所有业务数据仍在旧表里
3. 删除 AssetRegistry 不影响核心功能
4. 版本历史仅丢失优化记录，原始内容不受影响

---

## 10. W1 Freeze Rule

### 10.1 冻结清单（W1 期间禁止）

```
❌ 新导演理论（Director Field Theory 扩展）
❌ 新认知层（Cognition Loop 改进）
❌ 新仿真系统（Simulation Layer 扩展）
❌ 新自演化机制（Runtime Evolution）
❌ 新 Runtime 哲学（新抽象层）
❌ 新 DSL（脚本语言设计）
❌ 新 Orchestration 抽象层
```

### 10.2 W1 允许清单（含 4 个修正补丁）

```
✅ Schema 冻结（W1 蓝图中的数据库设计）
✅ Canonical Schema 约束层（每种 Asset 的最小结构定义）
✅ AssetRegistry + AssetVersion 表
✅ ContinuityLink 表
✅ InvocationLog 表
✅ 资产状态机（含 processing / locked / partial_failed 态）
✅ AIInvocationEnvelope（执行上下文信封 + traceId）
✅ 优化 Agent 封装
✅ 统一 AI Gateway 封装（envelope → adapter 模式）
✅ UI 改造（CardShell + OptimizationModal + VersionHistory）
✅ 旧数据迁移脚本（含双写窗口期）
✅ Agent prompt 更新（格式对齐 Canonical Schema）
✅ AssetGraphEdge 表 Schema 预留（W1 不实现，仅定义）
```

### 10.3 解锁条件

W1 完成标记：

- [ ] Prisma: AssetRegistry + AssetVersion + ContinuityLink + InvocationLog 表创建
- [ ] Prisma: AssetGraphEdge Schema 预留
- [ ] Canonical Schema 约束定义（5 种 Asset 的接口文件 + 校验函数）
- [ ] AIInvocationEnvelope 定义 + 链路追踪工具函数
- [ ] 后端路由: AssetRegistry CRUD
- [ ] 后端路由: AssetVersion（列表/详情/回滚）
- [ ] 后端路由: ContinuityLink（列表/更新/重建）
- [ ] 后端路由: InvocationLog（查询）
- [ ] AI Gateway: invokeAI() 统一入口（envelope → withUserModelConfig → adapter）
- [ ] 优化 Agent 标准协议实现（prompt 模板更新 + API 端点）
- [ ] 旧数据迁移脚本（含双写窗口 Phase W1a-W1b）
- [ ] 前端: CardShell 通用组件
- [ ] 前端: OptimizationModal 组件（对照表）
- [ ] 前端: VersionHistory 组件
- [ ] 前端: ContinuityIndicator 组件
- [ ] 所有卡片接入优化能力
- [ ] 双写开启（Phase W1c）校验通过
- [ ] 工作台 UI 词汇审查清理

以上全部完成 → 用户确认 → W1 解锁 → 开启 W2

---

---

## ⭐（Bonus）Asset Graph Index Layer

> 专家建议新增（非 W1 必须，但强烈建议在 W1 设计阶段预留接口）

### 问题场景

现有系统存在跨表依赖：
- 一个角色出现在多个镜头中
- 一个场景跨多个分镜
- 一个尾帧影响多个镜头
- 修改角色 → 所有引用了该角色的镜头需要标记"需重新生成"

如果只有 `AssetRegistry` 和 `ContinuityLink`，遇到"改角色→全图重算"时，你只能遍历所有 Storyboard 记录来查找引用——这就是 O(n) 扫描。

### 解决方案：AssetGraphEdge 表

```prisma
model AssetGraphEdge {
  id            String   @id @default(uuid()) @db.Uuid
  projectId     String   @db.Uuid

  fromAssetId   String   @db.Uuid        // AssetRegistry.id
  fromType      String                    // 'character' | 'scene' | 'storyboard' | ...
  toAssetId     String   @db.Uuid        // AssetRegistry.id
  toType        String
  relationType  String                    // 'appears_in' | 'uses' | 'continues_to' | 'references'

  metadata      Json?                     // 关系元数据（如「角色3」在「镜头2」中以「特写」出现）

  createdAt     DateTime @default(now())

  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, fromAssetId])
  @@index([projectId, toAssetId])
  @@index([projectId, relationType])
  @@map("AssetGraphEdge")
}
```

### 典型查询

```sql
-- 角色 A 出现在哪些镜头中？
SELECT * FROM AssetGraphEdge
WHERE projectId = ? AND fromAssetId = ? AND relationType = 'appears_in'

-- 修改了场景 B，需要重新生成哪些分镜？
SELECT DISTINCT toAssetId FROM AssetGraphEdge
WHERE projectId = ? AND fromAssetId = ? AND relationType IN ('belongs_to', 'references')

-- 哪个角色出现在最多镜头中？
SELECT fromAssetId, COUNT(*) as count FROM AssetGraphEdge
WHERE projectId = ? AND fromType = 'character' AND relationType = 'appears_in'
GROUP BY fromAssetId ORDER BY count DESC
```

### 何时加

- **W1 不做**（避免 scope creep）
- **W1 设计预留**：`AssetGraphEdge` 表在 schema 中定义为"可加但不必须"
- **W2 根据实际需求决定**：当用户开始频繁修改角色/场景并需要局部重渲染时，再加

---

## 附：W1 API 设计索引

### 资产注册中心
| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/workflow/asset-registry/:projectId` | 获取项目所有资产注册 |
| GET | `/api/workflow/asset-registry/:projectId/:type` | 按类型获取资产 |
| PUT | `/api/workflow/asset-registry/:id/status` | 更新资产状态 |

### 版本管理
| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/workflow/asset-registry/:id/versions` | 获取版本列表 |
| GET | `/api/workflow/asset-registry/:id/versions/:version` | 获取指定版本快照 |
| POST | `/api/workflow/asset-registry/:id/versions/:version/rollback` | 回滚到指定版本 |

### 连续性
| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/workflow/project/:projectId/continuity` | 获取连续性链路 |
| PUT | `/api/workflow/continuity/:id` | 手动修改连续链接 |
| POST | `/api/workflow/project/:projectId/continuity/rebuild` | 重建所有连续性 |

### 优化
| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/workflow/optimize` | 触发优化（异步） |
| GET | `/api/workflow/optimize/result/:assetRegistryId` | 获取优化结果 |

### 调用审计
| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/workflow/project/:projectId/invocations` | 项目调用日志 |
| GET | `/api/workflow/invocations/recent` | 最近调用（用户级别） |

---

> *本蓝图一经确认，即为 Phase W1 的协议冻结文档。*  
> *协议冻结后，所有开发必须严格遵守蓝图中定义的 Schema、协议、边界。*  
> *任何偏离必须经过 Review 并更新蓝图。*
