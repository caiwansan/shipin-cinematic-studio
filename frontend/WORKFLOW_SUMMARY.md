# 昆仑镜 AI Director OS v2 — 架构草案

> 这不是页面改版。这是 AI 原生影视创作操作系统。
> 版本：v2.0-draft | 日期：2026-05-26 | 审查人：用户 | 记录人：AI 助手

---

## 核心认知升级

```
之前：你在做 AI 工具页面
现在：你在做 AI 创作操作系统
```

这不是量变，是质变。三栏结构 + Stage Runtime + Agent 编排体系已经超出了「页面改版」的范畴，构成了 AI Director OS 的骨架。

---

## 一、现存的 4 个 OS 同时运行（最大风险）

系统目前实际处于**多操作系统并存**状态：

```
OS-1: /studio/production 旧工具系统     ← productionStage + hydrationStore + projectKernel
OS-2: /studio Stage FSM 新UI系统        ← WorkspaceStage + useCreativeWorkflow + persistence
OS-3: EntityGraph 数据系统              ← 正在设计中
OS-4: Sequel + Event 未来系统           ← 概念层
```

问题不是复杂，而是 **这些系统之间没有唯一真相源（Single Source of Truth）**。

当前状态主权完全分裂：

| 层 | 存在位置 | 问题 |
|----|---------|------|
| project state | hydrationStore / projectKernel / useCreativeWorkflow | 3 份 |
| stage | productionStage string / WorkspaceStage | 2 份 |
| characters | AigcSpecOutput + 各卡片组件 state | 2+ 份 |
| scene | AigcSpecOutput + SceneGeneration state | 2+ 份 |
| agent output | AigcSpecOutput 巨型 JSON | 1 份但无法分拆 |

同一个角色/场景/项目可能同时存在 3 个不同版本。

### ❗真正的结构风险（按严重程度）

| 风险 | 等级 | 说明 |
|------|------|------|
| 状态主权分裂 | 🔴 Critical | 多种 state + store + spec 共存，无唯一源 |
| Agent 输出无归属系统 | 🔴 Critical | characterSpecs 属 EntityGraph？AigcSpecOutput？Timeline？未定义 |
| Timeline 是附属而非主轴 | 🟡 High | Scene/Shot/Frame 并列，无时间主线 |
| Sequel 未绑定底层数据 | 🟡 High | FrozenSnapshot 概念正确但未依附 EntityGraph/Timeline |
| Runtime 边界重叠 | 🟡 Medium | Stage 管对象 / EntityGraph 管 timeline / Timeline 管 version |

---

## 二、解决：必须新增 Canonical Core Layer（唯一真相层）

当前缺失的不是功能，而是**统一内核（Kernel）**。建议新增一层：

```
┌─────────────────────────────────────────────────────────┐
│                Canonial Core Layer                       │
│             （唯一真相层 / System Kernel）                │
├─────────────────────────────────────────────────────────┤
│  CanonialProjectState                                    │
│  ├── CreativeDNA          ← 全局创作约束（唯一）         │
│  ├── EntityGraph          ← 所有实体唯一源               │
│  ├── Timeline              ← 时间唯一源                  │
│  ├── EventLog              ← 变化唯一源（未来）           │
│  └── SnapshotManager      ← 冻结/续集唯一入口            │
└─────────────────────────────────────────────────────────┘
```

### Canonical Core 的真正问题

Canonical Core 写对了，但缺最关键的一层：**运行时强制隔离（Kernel Enforcement）**。

```
现在：UI / Agent / Timeline / Stage 都"约定"不能越界
        → soft architecture（依赖开发纪律）

正确：Kernel 运行时拦截所有跨层写入
        → hard boundary（依赖系统拦截）
```

没有 Kernel enforcement，系统一定会漂移：
- Stage 写 Entity
- Timeline 改 Scene
- Agent 改 UI state
- Sequel 直接 patch graph
- AigcSpecOutput 复活

### 必须新增：Canonical Kernel（内核约束层）

最终系统只有 5 个东西：

```
Canonical Kernel（唯一入口 + 强制执行层）
  │
  ├── EntityGraph（实体唯一源）
  ├── Timeline（时间唯一源）
  ├── EventLog（变化唯一源）
  └── Snapshot（冻结态唯一源）
```

#### Kernel 设计

```typescript
class CanonicalKernel {
  // 唯一读入口
  read(projectId: string): CanonicalProjectState

  // 唯一写入口
  write(command: KernelCommand): void

  // 运行时验证器 — 核心：防止跨域写入
  validate(command: KernelCommand): boolean {
    // EntityGraph 只能被 Agent 写入
    if (command.target === 'EntityGraph' && command.source !== 'Agent') {
      throw new KernelViolation('Agent only can write EntityGraph')
    }
    // Timeline 只能被 TimelineStage 写入
    if (command.target === 'Timeline' && command.source !== 'TimelineStage') {
      throw new KernelViolation('TimelineStage only can write Timeline')
    }
    // UI 层只能读，不能写
    if (command.source === 'UI' && command.type !== 'READ') {
      throw new KernelViolation('UI layer is read-only')
    }
    // Sequel 只能通过 SnapshotManager 操作
    if (command.type === 'SEQUEL' && command.source !== 'SnapshotManager') {
      throw new KernelViolation('Sequel must go through SnapshotManager')
    }
    return true
  }
}
```

#### 各层权限矩阵

```
            │ 读 EntityGraph │ 写 EntityGraph │ 读 Timeline │ 写 Timeline │ 冻结/续集
───────────┼───────────────┼───────────────┼────────────┼────────────┼─────────
UI         │ ✅ ReadOnly   │ ❌ Denied     │ ✅ ReadOnly│ ❌ Denied  │ ❌
Stage      │ ✅ ReadOnly   │ ❌ Denied     │ ✅ ReadOnly│ ❌ Denied  │ ❌
Agent      │ ✅ ReadOnly   │ ✅ Allowed    │ ✅ ReadOnly│ ❌ Denied  │ ❌
Timeline   │ ✅ ReadOnly   │ ❌ Denied     │ ✅ ReadOnly│ ✅ Allowed│ ❌
Snapshot   │ ✅ ReadOnly   │ ❌ Denied     │ ✅ ReadOnly│ ❌ Denied  │ ✅
Sequel     │ ✅ ReadOnly   │ ❌ Denied     │ ✅ ReadOnly│ ❌ Denied  │ ✅ via SM
Execution  │ ✅ ReadOnly   │ ❌ Denied     │ ❌         │ ❌        │ ❌
```

### 最终收敛结构

```
Kernel（唯一入口 + enforcement）
  │
  ├── /api/v2/kernel/read    ← 所有读流经这里
  ├── /api/v2/kernel/write   ← 所有写流经这里（含 validate）
  └── /api/v2/kernel/command ← UI/Stage dispatch 的 command 流
              │
              ├── EntityGraph（后端表 + 内存 cache）
              ├── Timeline（时间轴索引）
              ├── EventLog（append-only）
              └── SnapshotManager（冻结/续集）
```

---

## 三、真正可落地的策略：后端最小内核补丁 + 前端 OS 化

```
Canonical Core（唯一真相层）
  │ 所有子系统都读它，禁止互相读
  │
  ├── UI Layer（只读 Canonial Core）
  │   ├── 三栏 Shell（Stage Runtime）
  │   ├── 左侧导航（项目/流程/VIP）
  │   ├── 中栏 Stage（当前创作主空间）
  │   └── 右侧栏（Selected Object IDE）
  │
  ├── Agent Layer（写 EntityGraph）
  │   ├── 8 Agents → EntityGraph
  │   └── Sequel → SnapshotManager
  │
  ├── Timeline（引用 EntityGraph 的 ID，不拷贝）
  │   └── Season → Episode → Scene[entityId] → Shot[entityId]
  │
  └── Execution Layer（只读 EntityGraph → Provider）
      ├── Image / Video / TTS / LLM
      └── ModelAdapterRegistry
```

### 关键规则

**❌ 禁止：**
- UI state 直接存角色数据
- Stage runtime 存 scene data
- AigcSpecOutput 作为长期存储
- 各子系统互相读取内部状态

**✔ 允许：**
- UI → 只读 Canonical Core
- Agent → 写 EntityGraph
- Timeline → 引用 EntityGraph（通过 ID，不复制数据）
- Sequel → 从 SnapshotManager 生成 FrozenSnapshot
- Execution → 只读 EntityGraph 的 entities

---

## 三、真正可落地的策略：后端最小内核补丁 + 前端 OS 化

当前系统的正确升级路径不是重写后端，而是：

```
Backend（最小内核补丁）→ 只加 2 个接口
                          ↓
Canonical Core API
                          ↓
Frontend（承担 OS 级重构）→ Stage Runtime + 三栏 + Agent UI
```

### 后端只需要 2 个最小改造

#### ① Canonical Project Snapshot API（只读）

```typescript
GET /api/v2/canonical/project/:id

Response: {
  creativeDNA: CreativeDNA          // 全局创作约束
  entityGraph: {
    characters: Map<Id, Entity>
    scenes: Map<Id, Entity>
    props: Map<Id, Entity>
    voices: Map<Id, Entity>
    effects: Map<Id, Entity>
    timeline: TimelineRef
  }
  timeline: TimelineGraph           // 时间唯一源
  snapshotVersion: number           // 版本戳
  frozenStateRef?: string           // 如已冻结，引用 FrozenSnapshot ID
}
```

**意义**：前端不再读 hydrationStore / productionStage store / AigcSpecOutput。只读这一个接口。

#### ② Entity-Level Write API（替代巨型 JSON）

替换当前的 AigcSpecOutput 全量 overwrite：

```typescript
// 列表
GET    /api/v2/canonical/project/:id/entity/:type

// 单实体操作
GET    /api/v2/canonical/project/:id/entity/:type/:entityId
PATCH  /api/v2/canonical/project/:id/entity/:type/:entityId  // 差分更新
DELETE /api/v2/canonical/project/:id/entity/:type/:entityId

// 再生
POST   /api/v2/canonical/project/:id/entity/:type/:entityId/regenerate

// Agent 批量写入
POST   /api/v2/canonical/project/:id/entity/batch
```

| 旧模式 | 新模式 |
|--------|--------|
| 一次生成整个 spec | 每个 entity 独立生成 |
| 全量 overwrite | PATCH diff update |
| store 驱动 UI | graph 驱动 UI |

### 三层的各自职责

```
Canonical Core Layer（后端提供，不可变规则）
  ├── 只读：GET /api/v2/canonical/project/:id
  ├── 写：Entity-Level Write API
  └── Agent：写 EntityGraph，不碰 UI

Frontend OS Runtime（前端承担 OS 重构）
  ├── StageMachine（WorkspaceStage FSM）
  ├── ThreePanelShell（三栏容器）
  ├── WorkflowEngine（左侧导航）
  ├── SelectionContext（右侧栏 IDE）
  └── UI → 只读 Canonical Core API

Agent Execution System（现有，不改）
  ├── 8 Agents → 只写 EntityGraph
  ├── Sequel → SnapshotManager
  └── Video/Image/TTS/LLM → EntityGraph 只读
```

### 三、系统级跃迁总结

3 个关键系统级跃迁已同时发生：

| 跃迁 | 从 | 到 |
|------|----|----|
| UI 范式 | Page Runtime（productionStage + if/else） | Stage Runtime（WorkspaceStage FSM） |
| 数据范式 | Object Store（AigcSpecOutput 巨型 JSON） | EntityGraph（ID + Version + Diff） |
| 创作范式 | Project（独立项目） | Narrative/Timeline（跨集连续宇宙） |

这三件事如果成立，系统确实是 AI Story OS，不是视频工具。

---

## 二、当前正确方向确认

### ✅ 1. Stage Runtime 已替代 Page Runtime（最重要的升级）

```
之前：页面驱动（productionStage string + if/else）
之后：创作状态机驱动（WorkspaceStage + composable）
```

AI 编剧 / AI 导演 / AI 分镜 / AI 视频 / AI 配音——这些本质上不是页面，而是 Runtime Phase。方向完全正确。

### ✅ 2. 三栏结构（Figma + Unreal + Notion + Runway 融合）

```
左栏（260px）：全局导航/创作流程/项目上下文
中栏（自适应）：当前创作阶段（Stage 主空间）
右栏（320px）：当前对象编辑器（AI Property Runtime）
```

- 中间永远是主创作空间
- 左侧永远是创作流程导航 + 项目上下文（降低迷失）
- 右侧未来会成为 AI IDE（修正/regenerate/variation/compare/history）

### ✅ 3. AIAnalyzingStage — AI 思考过程产品化

```
大部分 AI 产品：loading...
昆仑镜：AI 正在分析人物关系 / 建立镜头语言 / 拆解节奏
```

这大幅提升「AI 很强」的用户感知，非常有价值。

---

## 二、旧工作台完整功能清单

---

## 二、旧工作台完整功能清单

### 2.1 页面结构

旧工作台使用三栏布局，左侧栏 240px（固定），中栏自适应，右侧栏为保留占位：

**左侧栏（240px）：**
1. **流程步骤导航** — 10 步工作流，带图标/状态（活跃/完成/待处理）/计数气泡
2. **VIP 会员卡片** — 头像（首字母）、用户名、会员等级（普通/黄金/钻石/至尊/年卡）、升级入口（跳转 /user/center）
3. **大模型接入卡片** — 显示当前供应商（阿里百炼/火山引擎等）、API Key 已配置/未设置 状态、点击打开 ModelSettingsModal 弹窗

**中栏：** 根据 `productionStage` 字符串切换显示对应组件（见 2.2）

**右侧栏：** 占位显示「右侧面板即将上线」

### 2.2 10 步工作流与对应的前端组件

| 步骤 | 组件 | 功能 |
|------|------|------|
| ① 剧本 | `ScriptInput.vue` | textarea 编写剧本、项目管理（新建/删除/加载）、风格选择（dropdown）、比例选择（dropdown） |
| ② 角色 | `CharacterCreation.vue` | 角色卡生成/编辑/AI 优化、角色图片生成/上传/删除、从总指挥获取角色信息 |
| ③ 场景 | `SceneGeneration.vue` | 场景卡生成/编辑/AI 优化 prompt、场景图片生成/上传、从总指挥获取场景信息 |
| ④ 配音 | `VoiceGeneration.vue` | 角色配音配置（角色名/性别/年龄/声线/语速/情感基调）、批量生成语音、从总指挥获取配音配置 |
| ⑤ 分镜 | `StoryboardProduction.vue` | 视频段落列表（标题/叙事目的/时长）、分镜图片生成、渲染链式镜头、从总指挥获取分镜/帧数据 |
| ⑥ 画面 | `FrameProduction.vue` | 首帧/中帧/尾帧图片生成/AI 优化 prompt、从总指挥获取帧设计数据 |
| ⑦ 视频 | `DirectorStudio.vue` | 视频段列表、视频 prompt 优化、视频生成/状态轮询/重新生成、播放已生成视频 |
| ⑧ 合成 | `VideoComposition.vue` | 视频片段合成/裁剪/排序 |
| ⑨ 导出 | `ExportPublish.vue` | 最终视频导出和发布 |
| ⑩ 续集 | `QuickCreation.vue` | 快速创建续集/系列项目 |

### 2.3 Agent 后端体系（8 个 Agent + 动作优化器）

Agent 编排架构（AigcSpecOrchestrator）：

```
Phase 0: 剧情总指挥 (plot-supervisor)
          ↓ 输出剧情蓝图（纯叙事事实）
Phase 1: 角色设计师 + 场景设计师 + 角色定妆师（并行）
          ↓
Phase 2: 声音设计师 + 画面设计师（并行，依赖 Phase 1 结果）
          ↓
Phase 3: 道具设计师（依赖 Phase 1+2）
          ↓
Phase 4: 镜头/特效师（依赖全部前面）
          ↓
         视频段落动作优化 (action-optimizer + CinematicIR)
          ↓
         合并输出 AigcSpecOutput
```

#### Agent 详细说明

| # | Agent | Prompt 文件 | 输出 Key | 功能 |
|---|-------|------------|---------|------|
| 0 | 剧情总指挥 | `plot-supervisor.txt` | `plotBlueprint` | 分析剧本输出纯叙事事实：故事类型/角色概览/场景结构/世界观/情绪曲线/商业化定位。❌不包含任何拍摄指令 |
| 1 | 角色设计师 | `character-designer.txt` | `characterSpecs` | 角色身份/外貌/性格/背景/动机/关系/演变。每角色含 imagePrompt（11 字段包含时代风格） |
| 2 | 场景设计师 | `scene-designer.txt` | `sceneSpecs` | 场景位置/时间/氛围/视觉元素/情感基调。imagePrompt 要求 100+ 字，description 50+ 字 |
| 3 | 角色定妆师 | `makeup-designer.txt` | `characterMakeupSpecs` | 🆕 服装/造型/妆容/配饰设计，参考剧情蓝图的角色介绍 |
| 4 | 声音设计师 | `sound-designer.txt` | `voiceConfigs` | 配音配置：角色名/性别/年龄/声线/语速/情感基调/TTS 参数 |
| 5 | 画面设计师 | `frame-designer.txt` | `frameDesign` + `videoSegments` + `videoProduction` | 输出段落结构（标题/叙事目的/时长/首尾帧）、帧设计（imagePrompt/首帧/尾帧/布局） |
| 6 | 道具设计师 | `props-designer.txt` | `propSpecs` | 道具列表/外观/用途/出现场景/关联角色 |
| 7 | 镜头/特效师 | `director-of-photography.txt` | `effectSpecs` + `actionSpecs` + `cameraSpecs` + `emotionSpecs` | 特效设计/动作描述/运镜方案/情绪弧线 |

**额外：视频提示词优化师** (`video-prompt-optimizer.txt`) — 将段落叙事目的优化为 200-500 字详细视频描述（运镜/特效/动作/表情/光线五大维度全覆盖）

#### 输出数据结构

```typescript
interface AigcSpecOutput {
  plotBlueprint: any               // 剧情蓝图
  characterSpecs: any[]            // 角色规格（12+ 字段）
  characterMakeupSpecs: any[]      // 角色定妆规格（🆕）
  sceneSpecs: any[]                // 场景规格
  voiceConfigs: any[]              // 配音配置
  videoSegments: any[]             // 视频段落（标题/叙事目的/时长/imagePrompt）
  frameDesign: any[]               // 帧设计（首帧/尾帧/layout）
  videoProduction: any             // 视频生产参数
  propSpecs: any[]                 // 道具规格
  effectSpecs: any[]               // 特效规格
  actionSpecs: any[]               // 动作规格
  cameraSpecs: any[]               // 运镜规格
  emotionSpecs: any[]              // 情绪规格
}
```

### 2.4 旧工作台的核心数据流

```
ScriptInput `emit('parsed', { projectId, spec })`
  → production.vue `onScriptParsed()`
    → `buildDesignSpec(plotBP, data)` 生成 `designSpec`
      → `hydrationStore.designSpec = designSpec`
        → 各卡片组件（CharacterCreation/SceneGeneration/etc.）
          从 `hydrationStore.designSpec` 读取对应子数据
```

每个卡片组件支持三种数据填充方式：
1. **从总指挥获取** → 从 `hydrationStore.designSpec` 直接提取
2. **AI 优化** → 调后端 `/api/optimize/*` 或 `/api/v1/narrative/regen-spec`
3. **图片生成** → 调后端 `/api/execution-images/*`（含上传/删除/列表）

---

## 三、新工作台（Phase A）架构

### 3.1 设计原则

- **Stage-driven**：`WorkspaceStage` 类型驱动流程，非 if/else 切换
- **单一 Truth**：`useCreativeWorkflow()` composable 统一管理全部状态
- **持久化**：localStorage snapshot + 草稿自动保存，刷新可恢复
- **渐进式**：先跑通骨架流转，再接入 API，最后视觉打磨

### 3.2 Stage 定义

```typescript
type WorkspaceStage =
  | 'landing'           // Hero 首页
  | 'project-init'      // 项目创建
  | 'script-writing'    // AI 编剧工作台
  | 'ai-analyzing'      // AI 拆解分析
  | 'analysis-review'   // 导演控制台（审核）
  | 'character-design'  // 角色设计（未实现）
  | 'storyboard'        // 分镜制作（未实现）
  | 'video-render'      // 视频生成（未实现）
```

### 3.3 5 个已实现 Stage

| Stage | 组件 | 功能 |
|-------|------|------|
| landing | `LandingStage.vue` | Hero 区：「🎬 我要创作」大按钮，居中布局，AI 影视创作引擎标识 |
| project-init | `ProjectInitStage.vue` | 项目标题（大输入框）+ 一句话简介（小输入框），底部「下一步：开始编剧」按钮 |
| script-writing | `ScriptWritingStage.vue` | 左编辑区 + 右 AI 编剧助手，工具栏（模板弹窗/传 TXT），比例选择卡片（16:9/9:16/1:1/21:9），风格选择卡片（3D/写实/真实拍摄/油画/水彩），底部「✨ AI 开始拆解故事」按钮 |
| ai-analyzing | `AIAnalyzingStage.vue` | 9 阶段可视化动画（人物/世界观/场景/风格/情绪/配乐/节奏/商业化/镜头），每阶段 1.2 秒带过渡，实时展示检测到的角色标签和场景卡片 |
| analysis-review | `AnalysisReviewStage.vue` | 左侧显示剧本原文（可编辑返回），右侧显示九维分析卡片（世界观/角色/情绪/风格/镜头/场景/节奏/配乐/商业化），卡片可展开/编辑/重新生成 |

### 3.4 核心文件

```
frontend/components/studio/
├── StudioWorkflowShell.vue          ← 单页面容器 + 进度条
├── runtime/
│   ├── stage-machine.ts             ← WorkspaceStage 类型 + 转换定义
│   ├── persistence.ts               ← localStorage 持久化 + 草稿恢复
│   ├── useCreativeWorkflow.ts       ← 核心 composable（7 状态 + 14 动作）
│   └── index.ts
└── stages/
    ├── LandingStage.vue
    ├── ProjectInitStage.vue
    ├── ScriptWritingStage.vue       （~400 行，最核心）
    ├── AIAnalyzingStage.vue
    ├── AnalysisReviewStage.vue
    └── index.ts
```

---

## 四、新旧工作台对比矩阵

| 维度 | 旧工作台 `/production` | 新工作台 `/studio` |
|------|----------------------|--------------------|
| **布局** | 三栏（左 240px / 中自适应 / 右预留） | 单栏全屏（阶段切换） |
| **流程控制** | `productionStage` 字符串 + if/else | `WorkspaceStage` 类型驱动 |
| **状态管理** | 多个 Pinia store + hydration + projectKernel | `useCreativeWorkflow()` 单一 composable |
| **持久化** | 无（刷新丢失进度） | localStorage snapshot + draft，自动恢复 |
| **Hero 入口** | 无，直接进编辑 | 「🎬 我要创作」大按钮 |
| **项目创建** | 自动命名「新项目 YYYY-MM-DD」 | 创作者填写标题 + 一句话简介 |
| **编剧界面** | 纯 textarea | 左沉浸式编辑器 + 右 AI 编剧助手 |
| **风格选择** | dropdown select | 视觉卡片（带 emoji/描述/hover） |
| **比例选择** | dropdown select | 平台化卡片（YouTube/抖音/Instagram/Cinematic） |
| **官方模板** | 无 | 6 种模板弹窗（电影剧本/短视频/动漫/游戏/广告/AI MV） |
| **上传 TXT** | 无 | 支持，自动解析场景结构 |
| **AI 编剧助手** | 无 | 7 种操作（继续写/扩写/优化对白/增强冲突/改悬疑/生成高潮/生成结尾） |
| **AI 拆解动画** | spinner | 9 阶段全过程可视化 |
| **审核页** | 专业 Agent 卡片 | 九维可展开卡片（可编辑/重新生成） |
| **左侧导航** | ✅ 流程步骤 + VIP 卡片 + 模型设置 | ❌ 无 |
| **右侧面板** | 占位「即将上线」 | ❌ 无 |
| **真实 API** | ✅ 全部接入 | ❌ 模拟数据 |
| **角色设计** | `CharacterCreation.vue` | 未实现 |
| **场景设计** | `SceneGeneration.vue` | 未实现 |
| **配音配置** | `VoiceGeneration.vue` | 未实现 |
| **分镜制作** | `StoryboardProduction.vue` | 未实现 |
| **帧画面** | `FrameProduction.vue` | 未实现 |
| **视频生成** | `DirectorStudio.vue` + `VideoComposition.vue` | 未实现 |
| **导出发布** | `ExportPublish.vue` | 未实现 |
| **图片管理** | 上传/删除/列表（execution-images API） | 未实现 |
| **VIP 会员** | VIP 卡片 + 跳转中心 | ❌ 无 |
| **大模型设置** | ModelSettingsModal 弹窗 | ❌ 无 |

---

## 五、三栏控制台设计方案

### 5.1 页面布局

```
┌──────────────────┬───────────────────────────────┬──────────────────┐
│ 左侧栏（260px）  │      中间工作区（自适应）     │ 右侧栏（320px）  │
├──────────────────┼───────────────────────────────┼──────────────────┤
│                  │                               │                  │
│  ┌──────────┐   │  ┌─────────────────────────┐  │  ┌──────────┐   │
│  │ 用户头像  │   │  │  Stage 进度条（始终可见）│  │  │ 属性     │   │
│  │ 用户名    │   │  │ ①→②→③→④→⑤             │  │  │ 编辑     │   │
│  │ VIP 等级  │   │  └─────────────────────────┘  │  │ 面板     │   │
│  │ [升级]    │   │                               │  │          │   │
│  └──────────┘   │  ┌─────────────────────────┐  │  │ Stage    │   │
│                 │  │                         │  │  │ 上下文   │   │
│  ────────────   │  │   Stage 内容区           │  │  │ 相关     │   │
│                 │  │   (当前 Stage 主界面)    │  │  │          │   │
│  流程导航        │  │                         │  │  │ 选中角色 │   │
│  ✓① 剧本        │  │  LandingStage           │  │  │ → 编辑   │   │
│  ✓② AI拆解     │  │  ProjectInitStage        │  │  │ 描述     │   │
│  →③ 角色       │  │  ScriptWritingStage      │  │  │ 选中场景 │   │
│  ⚪④ 分镜       │  │  AIAnalyzingStage        │  │  │ → 编辑   │   │
│  ⚪⑤ 视频       │  │  AnalysisReviewStage     │  │  │ 参数     │   │
│                 │  │  CharacterDesignStage    │  │  │ 选中分镜 │   │
│  ────────────   │  │  StoryboardStage         │  │  │ → 编辑   │   │
│                 │  │  VideoStage              │  │  │ Prompt   │   │
│  大模型接入设置  │  │                         │  │  │          │   │
│  🧠 供应商/Key  │  └─────────────────────────┘  │  └──────────┘   │
│                 │                               │                  │
│  ────────────   │                               │                  │
│  最近项目列表   │                               │                  │
│                 │                               │                  │
└──────────────────┴───────────────────────────────┴──────────────────┘
```

### 5.2 左侧栏设计（继承旧工作台功能 + 扩展）

| 区域 | 内容 | 来源 |
|------|------|------|
| 用户信息 | 头像（首字母或上传）、用户名、VIP 等级标签、[升级] 按钮 | 继承旧 production.vue `vip-card-mini` |
| 流程导航 | 5 步主导航（剧本→AI拆解→角色→分镜→视频），带状态图标（✓完成/→当前/⚪待处理）和计数 | 新设计，精简自旧 10 步 |
| 大模型接入 | 卡片形式显示当前供应商 + API Key 状态，点击打开 ModelSettingsModal | 继承旧 `kl-model-card` |
| 最近项目 | 按更新时间倒序展示项目列表，支持「继续创作」和「删除」 | 新功能（旧在 ScriptInput 里） |

### 5.3 中间工作区设计

- **顶部进度条**：始终可见，5 步流程「① 剧本 → ② AI拆解 → ③ 角色 → ④ 分镜 → ⑤ 视频」
- **内容区**：根据当前 Stage 显示对应的主界面

Stage 主界面规格：

| Stage | 主界面内容 | 数据源 |
|-------|-----------|--------|
| landing | Hero 大按钮「🎬 我要创作」 | 无 |
| project-init | 项目标题输入 + 简介输入 + 下一步按钮 | 本地 |
| script-writing | **左：** 文本编辑器（支持模板/传TXT/富文本）**右：** AI 编剧助手面板，底部：风格卡片 + 比例卡片 + 提交按钮 | 本地 → API `/api/v2/director/generate` |
| ai-analyzing | 9 阶段可视化 + 实时标签展示 + 动态卡片生成 | API 轮询 |
| analysis-review | **左：** 剧本原文 **右：** 九维可展开卡片（每卡片含编辑/重新生成按钮） | API 返回的 AigcSpecOutput |
| character-design | 角色卡片网格 + 角色定妆卡 + AI 优化 + 角色图片生成 | 从 `AigcSpecOutput.characterSpecs` + `characterMakeupSpecs` 读取 |
| storyboard | 视频段落时间线 + 分镜图片生成 + 渲染链式镜头 | 从 `AigcSpecOutput.videoSegments` + `frameDesign` 读取 |
| video-render | 视频段列表 + prompt 优化 + 生成/状态轮询 + 播放 | API `/api/pipeline/stage/{pid}/video` |

### 5.4 右侧栏设计（新功能）

右侧栏为上下文敏感的属性编辑面板，根据中栏当前选中的对象动态切换：

| 中栏 Stage | 选中对象 | 右侧面板内容 |
|------------|---------|-------------|
| script-writing | — | AI 助手辅助面板（简化版，主功能已在中栏右侧） |
| analysis-review | 角色卡片 | 角色详情编辑：名称/描述/imagePrompt/定妆参数 |
| analysis-review | 场景卡片 | 场景详情编辑：位置/时间/氛围/描述/imagePrompt |
| character-design | 单个角色 | 角色属性面板：外貌/性格/背景/关系，含重新生成按钮 |
| character-design | 定妆 | 定妆编辑：服装/造型/妆容/配饰，参考图上传 |
| storyboard | 单个段落 | 段落编辑：标题/叙事目的/时长/首帧 prompt/尾帧 prompt |
| storyboard | 分镜图 | 图片预览 + 重新生成 + 下载 |
| video-render | 视频段 | 视频预览播放器 + prompt 编辑 + 重新生成 |

### 5.5 Agent 能力在三栏中的映射

旧工作台的 8 个 Agent + 视频提示词优化师，在新三栏中的位置：

```
阶段 0: 剧情总指挥（LLM API）
  → 触发于 script-writing → ai-analyzing 转换时
  → 中间栏显示 AIAnalyzingStage（9 阶段可视化）

阶段 1: 角色设计师 + 角色定妆师（LLM API）
  → 数据在 `AigcSpecOutput.characterSpecs` + `characterMakeupSpecs`
  → 中间栏 CharacterDesignStage 渲染角色卡片
  → 右侧栏显示选中角色的编辑面板

阶段 1: 场景设计师（LLM API）
  → 数据在 `AigcSpecOutput.sceneSpecs`
  → 整合进 CharacterDesignStage（场景作为角色上下文）

阶段 2: 声音设计师（LLM API → TTS API）
  → 数据在 `AigcSpecOutput.voiceConfigs`
  → 中间栏 CharacterDesignStage 的"配音"子面板
  → 右侧栏显示选中角色的配音参数编辑

阶段 2: 画面设计师（LLM API）
  → 数据在 `AigcSpecOutput.videoSegments` + `frameDesign`
  → 中间栏 StoryboardStage 渲染时间线和分镜

阶段 3: 道具设计师（LLM API）
  → 数据在 `AigcSpecOutput.propSpecs`
  → 右侧栏在 scene/character 选中时显示关联道具

阶段 4: 镜头/特效师（LLM API）
  → 数据在 `AigcSpecOutput.effectSpecs` + `actionSpecs` + `cameraSpecs`
  → 整合进 StoryboardStage 的段落编辑面板

视频优化: 视频提示词优化师（LLM API → Video API）
  → 触发于 storyboard → video-render 转换时
  → 中间栏 VideoStage + 右侧栏 prompt 编辑

图片生成: execution-images API（Image API）
  → 角色/场景/分镜/帧各阶段调用对应 API
  → 生成的图片 URL 存储在 hydrationStore
  → 各 Stage 内部展示已生成图片

视频生成: pipeline/stage API（Video API）
  → 调用 Video API submit → 轮询状态 → 获取 URL
  → 中间栏 VideoStage 展示生成进度和结果
```

### 5.6 状态管理设计

```
useCreativeWorkflow() — 单一全局状态
├── WorkspaceStage     ← 当前阶段
├── ProjectInfo        ← 项目 id/name/summary
├── ScriptState        ← 剧本内容 + 风格 + 比例
├── AigcSpecOutput     ← 8 Agent 完整输出（合并后的完整数据）
├── SelectedObject     ← 右侧栏当前选中对象（id + type）
├── Persistence        ← localStorage 自动快照 + 恢复
└── DraftManager       ← 草稿自动保存 + 版本管理
```

---

## 六、需要立即解决的架构问题

### 🔴 问题 0（核心）：缺失续集引擎 — 跨集连续性架构

当前：每部剧是一个独立项目，做完即止。
缺失：**续集引擎（Sequel Engine）**——从现有项目安全衍生续集的能力。

#### 续集的本质不是「复制」，是「冻结 + 展开」

```
第 1 集 → 冻结角色设计、场景设计、人物关系、视觉风格 → 展开新故事
第 2 集 → 继承冻结资产 + 角色自然演变（不漂移）→ 展开新故事
第 3 集 → 继承第 2 集演变后的状态 → 展开新故事
...
```

#### 不引入续集引擎的后果

| 问题 | 表现 |
|------|------|
| **人设漂移** | 第 2 集角色设计师重新跑 LLM，随机生成不同的外貌/性格 |
| **场景不一致** | 同一间房间第 1 集和第 2 集描述完全不同 |
| **关系断裂** | 第 1 集情侣在第 2 集变成陌生人 |
| **故事逻辑崩** | 第 1 集结尾角色死了，第 2 集又活着出现 |
| **风格分裂** | 第 1 集写实风，第 2 集自动变成动画风 |
| **定妆不一致** | 角色服装/造型每集完全不一样 |
| **配音崩塌** | 同一角色每集用不同的声线/TTS 参数 |

#### 续集引擎的核心设计

```typescript
interface SequelEngine {
  // 冻结层：项目终态的完整快照（不可变）
  frozenSnapshot: {
    creativeDNA: CreativeDNA           // 全局创作上下文
    characters: FrozenCharacter[]      // 角色设计（含定妆 + 图片引用）
    scenes: FrozenScene[]              // 场景设计（含图片引用）
    relationships: RelationshipGraph   // 人物关系网
    timeline: TimelineGraph            // 时间线骨架
    propRegistry: FrozenPropRegistry   // 道具注册表
    styleGuide: VisualStyleGuide       // 视觉风格指南
    voiceProfile: VoiceProfile[]       // 配音档案
    continuityLog: ContinuityEvent[]   // 连续性事件日志
  }

  // 展开层：冻结资产注入新 Agent 调用
  generationInput: {
    sourceSnapshot: FrozenSnapshot      // 挂载冻结快照
    newScript: string                   // 新剧本
    timeSkip: 'immediate' | 'short' | 'long'  // 时间跨度
    characterStateOverrides?: Record<CharacterId, CharacterStateUpdate>
  }

  // 校验层：生成后做连续性检测
  validationReport: {
    characterConsistency: number        // 人设一致性评分 (0-1)
    sceneConsistency: number            // 场景一致性评分 (0-1)
    relationContinuity: number          // 关系连续性评分 (0-1)
    logicViolations: LogicViolation[]   // 逻辑冲突列表
  }
}
```

#### 冻结快照包含什么

```
FrozenSnapshot（项目终态冻结，不可变）
├── creativeDNA          ← 风格/基调/节奏/受众
├── characters[]         ← 每个角色：ID + name + 外貌 + 性格 + 背景 + imagePrompt + 定妆 + 已生成图片引用
├── scenes[]             ← 每个场景：ID + name + 位置 + 时间 + 氛围 + imagePrompt + 已生成图片引用
├── relationships        ← 关系图谱：谁和谁什么关系，在第几集发生了什么
├── timeline             ← 时间线：剧集内的 Scene→Shot 映射
├── props[]              ← 道具注册：道具ID + 外观 + 使用场景
├── styleGuide           ← 视觉风格：色调/光影/构图/运镜偏好
├── voice[]              ← 配音档案：每个角色声线/TTS参数/语速/情感基调
└── continuityLog[]      ← 连续性事件：第N集做了什么决定、第M集谁死了
```

#### 左侧栏项目列表中的续集入口

```
项目卡片（最近项目列表）
├── 项目名称
├── 最后编辑时间
├── 状态标签 (已完成 / 进行中)
└── 操作按钮
    ├── [继续创作]  ← 回到项目中栏继续编辑
    ├── [创建续集]  ← 打开续集创建流程
    └── [删除]      ← 删除项目

点击 [创建续集] → 弹出续集创建面板：
├── 源项目锁定显示（不可修改）
│   ├── 项目名称 + 集号 (S01E01)
│   ├── 角色数量 (12人) + 场景数量 (8个)
│   └── 视觉风格 + 故事类型
├── 新项目设置
│   ├── 新剧本输入 (textarea / 传TXT)
│   ├── 时间跨度选择 (紧接着 / 短时间后 / 多年后)
│   └── 角色状态调整（可选：哪个角色发生了突变？）
└── [生成续集] 按钮 → 后端执行续集引擎
```

#### 续集引擎对 8 个 Agent 的影响

```
Phase 0: 剧情总指挥
  → 输入：FrozenSnapshot + 新剧本
  → 输出：新剧本的剧情蓝图（引用 sourceSnapshot 的角色名称/关系/场景）

Phase 1: 角色设计师
  → 输入：FrozenSnapshot.characters + 新剧本
  → 约束：禁止改变外貌/性格/背景（允许自然演变成长）
  → 输出：角色状态更新（基于旧角色映射新剧本中的发展）

Phase 1: 场景设计师
  → 输入：FrozenSnapshot.scenes + 新剧本
  → 约束：已有场景复用（名称/位置/氛围不变），新场景按风格指南生成

Phase 1: 角色定妆师
  → 输入：FrozenSnapshot.characters.makeup + 新剧本时间跨度
  → 约束：服装造型根据时间跨度可微调（换季/成长），但风格一致

Phase 2: 声音设计师
  → 输入：FrozenSnapshot.voiceProfile + 新剧本
  → 约束：声线/TTS 参数完全锁定，不重新生成

Phase 2: 画面设计师
  → 输入：FrozenSnapshot.styleGuide + 新剧本段落
  → 约束：视觉风格（色调/构图/光影）完全继承

Phase 3: 道具设计师
  → 输入：FrozenSnapshot.propRegistry + 新剧本
  → 约束：已有道具复用，新道具按风格指南生成

Phase 4: 镜头/特效师
  → 输入：FrozenSnapshot.timeline + 新剧本
  → 约束：运镜风格/剪辑节奏继承，新镜头按指南生成

视频提示词优化师
  → 输入：FrozenSnapshot.characters.已生成图片引用 + 新段落
  → 约束：首帧/尾帧引用旧图片保证连续性
```

#### 连续性校验

续集生成后自动执行：
```typescript
interface ContinuityCheck {
  // 人设校验
  characterDrift: { id: string; name: string; driftScore: number; violations: string[] }[]
  // 场景校验
  sceneDrift: { id: string; name: string; driftScore: number; violations: string[] }[]
  // 关系校验
  relationBreak: { from: string; to: string; expected: string; found: string }[]
  // 逻辑校验
  logicCheck: {
    deadCharacterAppears: string[]     // 本应死了的角色又出现了
    timelineConflict: string[]         // 时间线矛盾
    locationTeleport: string[]         // 角色瞬间位移
  }
  // 总体评分
  overallConsistency: number          // 0-1，低于 0.8 告警
}
```

#### 续集引擎在 Timeline Runtime 中的体现

```
Timeline（时间线，跨集）
├── Season 1 (被冻结，只读)
│   ├── Episode 1
│   │   ├── Scene 1..N
│   │   └── Shot 1..N
│   └── Episode 2
│       └── ...
├── Season 2（新生成，可变）
│   ├── Episode 1（当前创作中）
│   │   ├── Scene 1..N
│   │   └── Shot 1..N
│   └── Episode 2（待生成）
│       └── ...
└── 冻结边界 → 续集引擎在此创建 Season 2
```

每个 Season 是一个可独立冻结/展开的单元。Season 2 继承 Season 1 冻结快照。

---

### 🔴 问题 1：双 Runtime 并存（未来最大炸点）

当前状态：
```
旧 Runtime：/studio/production  ←  productionStage + hydrationStore + projectKernel
新 Runtime：/studio              ←  WorkspaceStage + useCreativeWorkflow + persistence
```

这是双状态系统。未来必然出现：
- hydration 不一致
- 数据来源冲突
- draft 恢复冲突
- project 同步冲突
- API schema 分裂
- UI 状态漂移

**解决策略：旧 `/studio/production` 立即进入 Legacy Maintenance Mode**

规则：
- ❌ 不再新增功能
- ❌ 不再新增状态
- ❌ 不再新增 workflow
- ✅ 只修 bug
- 所有未来能力全部进入新 Runtime

### 🔴 问题 2：AigcSpecOutput 正在变成超级巨型对象

当前结构：
```typescript
interface AigcSpecOutput {
  plotBlueprint      // 剧情蓝图
  characterSpecs     // 角色
  sceneSpecs         // 场景
  voiceConfigs       // 配音
  videoSegments      // 视频段落
  frameDesign        // 帧设计
  propSpecs          // 道具
  effectSpecs        // 特效
  actionSpecs        // 动作
  cameraSpecs        // 运镜
  emotionSpecs       // 情绪
  characterMakeupSpecs // 定妆
}
```

现在勉强能撑。但未来「可编辑 / 多版本 / 局部 regenerate / AI diff / 历史记录 / 回滚 / 协作编辑」进来后，这个巨型 JSON 会变成灾难。

**解决：升级为 Narrative Graph Runtime**

```typescript
interface EntityGraph {
  characters: Map<EntityId, CharacterEntity>
  scenes: Map<EntityId, SceneEntity>
  shots: Map<EntityId, ShotEntity>
  props: Map<EntityId, PropEntity>
  voices: Map<EntityId, VoiceEntity>
  effects: Map<EntityId, EffectEntity>
  timeline: TimelineGraph
}

interface Entity {
  id: string           // 独立 ID
  version: number      // 独立版本
  spec: any            // 实体数据
  createdAt: number
  updatedAt: number
  parentId?: string    // 关联关系
}
```

每个实体独立 ID、独立版本、独立 regenerate、独立 persistence。
修改一个角色不会导致整个 spec 重写。

### 🔴 问题 3：缺失 Timeline Runtime

当前：角色、场景、分镜、视频各自存在
缺失：**时间轴**

影视系统核心是 Narrative Timeline：
```
Timeline
├── Scene
│   ├── Shot
│   ├── Dialogue
│   ├── Camera
│   └── Audio
```

没有 Timeline，未来节奏控制、镜头重排、视频拼接、多镜头编辑都会崩。

### 🔴 问题 5：Runtime 边界即将重叠

当前各 Runtime 开始互相侵入：

| Runtime | 开始侵入 |
|---------|---------|
| Stage Runtime | 管对象 |
| EntityGraph | 管 timeline |
| Timeline | 管 version |
| Sequel Engine | 管状态冻结 |
| CreativeDNA | 管全局 context |

说明系统正在从"模块系统"演化成"操作系统"。这是正常的，但危险在于 **Runtime Ownership** 不明确，未来必然出现双写、双状态、graph drift、timeline drift、stale entity、orphan version。

**解决：立即创建 Runtime Ownership Matrix**

```text
Runtime Ownership Matrix（所有权矩阵）

Stage Runtime
  → 唯一职责：UI flow / Stage 转换 / 中间栏渲染
  → 不拥有：数据、实体、timeline、版本

EntityGraph (Narrative Graph Runtime)
  → 唯一职责：canonical entities / 实体级版本管理
  → 不拥有：UI、timeline 排序、continuity

Timeline Runtime
  → 唯一职责：temporal ordering / Scene→Shot 时间结构
  → 不拥有：实体数据、版本历史
  → 引用：EntityGraph 的 entities（通过 ID，不拷贝）

Sequel Engine
  → 唯一职责：continuity freeze / inherit
  → 不拥有：实体数据、timeline、UI
  → 输入：FrozenSnapshot（从 EntityGraph + Timeline + CreativeDNA 快照生成）

CreativeDNA
  → 唯一职责：global creative constraints
  → 不拥有：具体实体
  → 被：所有 Agent 共享引用

Event Runtime（未来）
  → 唯一职责：history / replay / undo / diff
  → 不拥有：当前状态
  → 输入：所有其他 Runtime 的变更事件

Execution Runtime
  → 唯一职责：provider dispatch / model routing
  → 不拥有：业务数据
  → 输入：EntityGraph 的 entities → LLM/Image/Video/TTS
```

当前只有：项目标题、简介、风格、比例

未来必须有持久化创作 DNA，所有 Agent 共享：
```typescript
interface CreativeDNA {
  genre: string
  emotionalTone: string
  pacing: 'slow' | 'normal' | 'fast'
  audience: string
  cinematicStyle: string
  platformTarget: string
  visualMood: string[]
}
```

防止各 Agent 风格漂移。

---

## 七、修正后的实施路线图

### Phase 0 — Canonical Core + Kernel（必须先做）

**定义唯一真相层 + 强制执行层，否则后面全部漂移。**

**后端改动（最小内核补丁 — 3 个接口）：**

| 任务 | 说明 | 代码位置 |
|------|------|---------|
| `POST /api/v2/kernel/command` | **唯一写入口** — 含 Kernel.validate() 运行时拦截 | 新建 `kernel/routes/command.ts` |
| `GET /api/v2/kernel/read` | 唯一读入口 — 聚合 CreativeDNA + EntityGraph + Timeline | 新建 `kernel/routes/read.ts` |
| `POST /api/v2/kernel/write` | 后端内部写入口 — Agent/TimelineStage/SnapshotManager 用 | 新建 `kernel/routes/write.ts` |
| `CanonicalKernel` 类 | validate() + route() + enforce() | `kernel/kernel.ts` |
| `KernelValidator` | 运行时权限矩阵 | `kernel/validate.ts` |
| `EntityGraphStore` | 实体 CRUD + version + diff + regenerate | `kernel/entity-graph.ts` |
| `TimelineStore` | 时间轴 CRUD（Season→Episode→Scene→Shot） | `kernel/timeline.ts` |
| `EventLogStore` | append-only event store | `kernel/event-log.ts` |
| `SnapshotManager` | freeze + spawn + list | `kernel/snapshot-manager.ts` |
| CreativeDNA 类型 + DB | entity_graph 表 type='dna' 行 | `kernel/creative-dna.ts` |
| **详细代码级设计** | 参见 `docs/RUNTIME_EXECUTION_GRAPH.md` | 文档 |

**前端改动（OS 化重构）：**

| 任务 | 说明 |
|------|------|
| `useCanonicalCore()` composable | dispatch() + load()，只读 Kernel，不直接操作数据 |
| 废弃 hydrationStore / projectKernel 直读 | 所有组件切到 useCanonicalCore() |
| StageMachine 重构 | Stage = UI Flow Controller, EntityGraph = Data Owner |
| ThreePanelShell 实现 | 左/中/右三栏容器 |
| 旧系统冻结声明 | `/studio/production` Legacy Maintenance Mode |

### Phase 1 — EntityGraph 接管 AigcSpecOutput

| 任务 | 说明 |
|------|------|
| 后端实体表 | characters / scenes / props / voices / effects / timeline |
| Agent 输出拆分 | 8 个 Agent 各自写入独立实体表（不再合并为巨型 JSON） |
| Canonical Core 集成 | EntityGraph 从 DB 读取，Agent 写入时验证 CreativeDNA 一致性 |
| 前端 Store 迁移 | useCreativeWorkflow → 读 Canonical Core（非直接读写本地状态） |
| 局部 regenerate 接口 | `POST /api/v2/entity/:type/:id/regenerate` |
| Canonical Core 只读化 | UI 层只能读，不可直接写 |

### Phase 2 — Timeline Runtime 成为主轴

| 任务 | 说明 |
|------|------|
| Timeline 类型定义 | Season → Episode → Scene → Shot → Dialogue/Camera/Audio |
| Timeline 实体引用 | Scene 引用 EntityGraph 的 sceneId，不复制数据 |
| 后端 Agent Phase 2 | 画面设计师输出改为 Timeline 结构 |
| Canonical Core Timeline | Timeline 作为 Canonical 的第二支柱（EntityGraph + Timeline） |
| 前端 Timeline Stage | 可视化时间轴 + 拖拽编辑 |

### Phase 3 — Sequel Engine 绑定 SnapshotManager

| 任务 | 说明 |
|------|------|
| FrozenSnapshot 类型 | 基于 Canonical Core 的完整快照（EntityGraph + Timeline + CreativeDNA） |
| SnapshotManager.freeze() | 项目终态冻结序列化到 DB |
| SnapshotManager.spawn() | 冻结快照 + 新剧本 = SequelJob |
| Agent 续集约束注入 | 8 个 prompt 尾部追加「不可改变约束条件」+ 引用 FrozenSnapshot 实体 ID |
| 连续性校验引擎 | 生成后运行时通过 Canonical Core 比对 drifted/frozen |
| 前端左侧栏续集入口 | 已完成项目显示 [创建续集] 按钮 + 弹窗 |

### Phase 4 — Event Runtime（Event Sourcing）

| 任务 | 说明 |
|------|------|
| CreativeEvent 类型 | type / timestamp / actor / entityId / before / after / reason |
| Event Log 存储 | append-only event store（PostgreSQL JSONB） |
| Reducer 层 | Event Log → Canonical Project State（类似 Git） |
| Undo/Redo API | `POST /api/v2/event/undo/:eventId` |
| Diff API | `GET /api/v2/event/diff/:fromId/:toId` |
| Branch API（未来） | `POST /api/v2/event/branch` — fork 时间线 |
| Collaboration API（未来） | merge / conflict resolution |

### Phase 5（视觉打磨 — 后期独立迭代）

- 深色电影风主题系统化
- 毛玻璃 / 玻璃态 UI
- 过渡动画（Stage 切换 + 卡片展开）
- 移动端响应式适配

---

## 八、关键设计决策

1. **旧系统立即冻结，不长期并行**：旧 `/studio/production` 进入 Legacy Maintenance Mode，只修 bug 不加功能。所有新能力只进新 Runtime，防止双状态系统分裂
2. **AigcSpecOutput → Narrative Graph**：巨型 JSON 立即升级为 EntityGraph，每个实体独立 ID + 版本 + regenerate
3. **三栏 vs 全屏**：三栏结构（左侧导航 / 中栏创作 / 右侧 AI IDE）是成熟创作工具形态，方向正确
4. **5 步精简 vs 10 步详细**：旧 10 步太碎片化，精简为 5 阶段（剧本→拆解→角色→分镜→视频）
5. **Stage-driven vs page-driven**：单页面 Stage 切换，创作状态机驱动
6. **Timeline Runtime 作为影视核心骨架**：Scene→Shot→Dialogue→Camera→Audio 分层设计
7. **Creative DNA 防止风格漂移**：全局创作上下文由所有 Agent 共享
8. **单一 composable vs 多个 store**：`useCreativeWorkflow()` 继续作为 unified state container
9. **续集引擎是架构级能力，不是功能级补丁**：跨集连续性必须深入 Agent 体系（prompt 约束注入）、存储体系（FrozenSnapshot 不可变序列化）、前端体系（左侧栏创建续集入口），不是简单的「复制项目」
10. **角色/场景/视觉不漂移的根因是 FrozenSnapshot**：续集生成的根基是「项目终态冻结」，LLM Agent 的 prompt 尾部必须有「约束条件」，不允许自由重生成已冻结的实体
11. **EntityGraph 不是终态，Event Sourcing 才是终态**：Creative Events（regenerate/rewrite/replace/delete/retime）本质是事件，不是状态。未来终态是 Creative Event Log → Reducer → Narrative State，类似 Git + Unreal Sequencer + Figma History 融合
12. **缺失统一内核（Kernel）是当前最大结构风险**：架构已经是 OS 级，但没有 Canonical Core Layer。当前 4 个 OS(旧工具系统/新UI系统/数据系统/未来系统) 共存，状态主权完全分裂。必须先建 Canonical Core 再拆 EntityGraph
13. **Canonical Core Layer 的规则**：所有子系统必须读 Core，禁止互相读彼此的内部状态。UI 只读、Agent 写 EntityGraph、Timeline 引用 ID 而非复制
14. **Runtime Ownership Matrix 必须在 Canonical Core 中定义**：Stage/EntityGraph/Timeline/Sequel/CreativeDNA/Event/Execution 各 Runtime 的职责边界和可读/可写权限一并锁定
15. **Kernel Enforcement Layer 是 Canonial Core 的唯一保障**：没有运行时拦截，所有架构规则都是"软约束"（soft architecture）。KernelValidator 必须在所有写操作入口强制执行权限矩阵

---

## 附：工程级 Blueprint

详细代码级设计（模块拆分、类型定义、CRUD 方法、DB Schema、迁移策略）请参见：

👉 **`docs/RUNTIME_EXECUTION_GRAPH.md`**

该文档包含：

| 章节 | 内容 |
|------|------|
| Kernel 模块 | `CanonicalKernel` 主类 + `KernelValidator` 强制执行 + 权限矩阵 |
| EntityGraph | 6 种实体类型 + DB Schema（entity_graph 表）+ CRUD + version/diff/rollback |
| Timeline | Season→Episode→Scene→Shot 四层 + 冻结/可变规则 |
| SnapshotManager | freeze() / spawn() / list() / getCurrent() + FrozenSnapshot 完整类型 |
| CreativeDNA | 持久化全局创作上下文 |
| 前端 useCanonicalCore | dispatch() / load() / 便捷 computed 属性 |
| 完整运行时流程图 | 关键路径：AI 生成角色 / 拖拽分镜 / 创建续集，每一步都标注 Kernel 权限校验 |
| 零崩溃迁移策略 | 4 步：新增代码→双写→前端切→废弃旧存储 |
