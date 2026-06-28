# 影剧厂（昆仑镜）AI 短剧制作系统工作原理

> **版本：** Production v2.5 | **代码规模：** 20.6 万行（后端 12.4 万 + 前端 8.2 万）
> **运行环境：** Node.js 22 + Nuxt 3 + Prisma + PostgreSQL + BullMQ

---

## 摘要

影剧厂（昆仑镜）是一套面向 AI 短剧制作的全栈智能系统，核心能力是将一段原始剧本文本，通过多 Agent 协作拆解为分角色、分场景、分镜头的完整制作脚本，并逐帧调用大模型（LLM/TTS/Image/Video）完成素材生成。本文从系统架构、运行时原理、AI Agent 工作流、配置治理、观测层五个维度阐述其工作原理。

**关键词：** AI 短剧制作、多 Agent 协作、模型适配器注册表、配置主权层、导演观测量

---

## 第一章 系统架构总览

### 1.1 三层架构

系统采用经典的三层架构，并在此基础上根据 AI 任务特点进行了深度定制：

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI LAYER (前端)                              │
│  Nuxt 3 + Vue 3 + TypeScript                                        │
│  475 文件 | 82,017 行                                                │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐                │
│  │ Studio 工作台│  │ 导演控制台   │  │ 大模型设置   │                │
│  └─────────────┘  └──────────────┘  └─────────────┘                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP/SSE
┌─────────────────────────▼───────────────────────────────────────────┐
│                      API LAYER (后端)                                │
│  Express.js + TypeScript                                             │
│  804 文件 | 124,468 行                                               │
│  ┌─────────┐ ┌──────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │ Route层 │ │ Agent层  │ │ Runtime层       │ │ Config主权层     │  │
│  │24,847行 │ │ 1,653行  │ │ 6,319行         │ │ (config-runtime) │  │
│  └─────────┘ └──────────┘ └────────────────┘ └──────────────────┘  │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────────┐    │
│  │ Model Adapters │ │ Queue (BullMQ) │ │ Director OS 观测层   │    │
│  │  注册表 (MSAL) │ │  异步执行层    │ │ 19,779 行            │    │
│  └────────────────┘ └────────────────┘ └──────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Services 层: LLM/TTS/Image/Video Provider + Crypto + Trace  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Prisma ORM
┌─────────────────────────▼───────────────────────────────────────────┐
│                     DATA LAYER (PostgreSQL)                         │
│  Prisma Schema 3,216 行                                             │
│  核心表: User / Project / ExecutionResult / UserModelConfigV2 /    │
│  NarrativeSession / LlmExecutionTrace / VideoTask / 等              │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 前端工作台设计

前端是一个单页应用（SPA），以"短剧工作台"为核心交互范式：

- **Studio 工作台** — 剧本输入 → AI 拆解 → 分场景 → 分角色 → 分镜头 → 生成素材的流水线
- **导演控制台** — 项目状态总览，各环节进度可视化
- **大模型设置** — BYOK（Bring Your Own Key）模态框，用户自配 Key 和模型

前端遵循"零硬编码"原则：所有 Provider/模型/API 端点从后端动态拉取。

---

## 第二章 AI Agent 工作流

这是系统的核心创新——通过多 Agent 协作完成剧本到分镜的自动化拆解。

### 2.1 工作流总览

```
原始剧本（用户输入）
    │
    ▼
┌──────────────────────────────────────────────┐
│  Phase 0: 剧情总指挥 (plot-supervisor)        │
│  读取剧本 → 输出 plotBlueprint                │
│  · scenes[].script = 80-150字完整剧本正文     │
│  · scenes[].segments[].script = 视频段落实体  │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│  Phase 1: 角色设计师 + 场景设计师             │
│  读取 scenes[].script → 抽取实体 → 填卡片    │
│  · character.imagePrompt = 画面描述          │
│  · scene.imagePrompt = 环境描述              │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│  Phase 2: 定妆设计师 + 声音设计师 + 道具师    │
│  · 角色服装/造型/声音/道具详情                │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│  Phase 3: 分镜设计师 + 摄影指导 + 动作指导    │
│  · frame.imagePrompt = 镜头画面               │
│  · videoPrompt = 200-500字视频描述            │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│  执行阶段: LLM → Image → TTS → Video         │
│  通过 ModelAdapterRegistry 路由                │
└──────────────────────────────────────────────┘
```

### 2.2 剧情总指挥 —— 剧本重构者（plot-supervisor.txt）

总指挥是整个系统的"第一推动力"。它的 prompt 经过重构后，角色定位从"给工作流分配提示词"变为**剧本重构者**：

- **输入：** 用户原始剧本（可能是故事大纲/对话录/小说片段/诗歌）
- **输出：** `plotBlueprint` 结构化 JSON
  - `scenes[].script` — **必须**包含 80-150 字完整剧本正文（这是下游 Agent 的唯一剧情事实源）
  - `scenes[].segments[].script` — 每个视频段落独立剧本
  - `scenes[].description` — 场景环境概要
  - `characters[]` — 角色列表及外观
- **关键约束：** scenes[].script 不可为空。如果为空，下游所有 Agent 将缺乏剧情上下文，生成的画面将与剧本无关。

### 2.3 专业 Agent —— 主动读取者

每个专业 Agent（角色/场景/摄影/化妆/道具/动作/声音/分镜/视频）遵循"先读脚本再填充"的工作模式：

1. 接收 `plotBlueprint.scenes[].script` 作为剧情上下文
2. 从对应场景的 script 中提取该专业领域所需的信息
3. 填充到卡片字段（imagePrompt / description 等）
4. 用户可微调后提交给 AI 优化

前端优化按钮自动附带 `projectId`，后端路由从 DB 读取 `plotBlueprint.scenes[].script`，确保 Agent 始终拿到正确的剧情事实源。

### 2.4 Agent Prompt 设计哲学

所有 Agent prompt 存放在 `backend/src/prompts/agents/`，以 txt 文件存在（无需编译）：

```
agents/
  plot-supervisor.txt          # 剧情总指挥
  character-designer.txt       # 角色设计师
  scene-designer.txt           # 场景设计师
  makeup-designer.txt          # 定妆设计师
  sound-designer.txt           # 声音设计师
  props-designer.txt           # 道具师
  director-of-photography.txt  # 摄影指导（分镜设计）
  frame-designer.txt           # 分镜设计师
  action-optimizer.txt         # 动作指导
  video-prompt-optimizer.txt   # 视频提示词优化
```

设计要点：
- 每个 Agent 都注入"顶级影视导演/设计师"身份
- imagePrompt 从 11 个字段描述角色外观（年龄/肤色/发型/配饰/服装/姿态/表情/光影/景别/时代风格）
- videoPrompt 要求 200-500 字详细视频描述（镜头运动+角色动作+环境变化+情绪氛围）

### 2.5 提示词优化的"优化提示词"按钮

前端每个卡片都带了"优化提示词"按钮，其工作流为：

```
用户点击"优化提示词"
  → 前端收集：卡片字段 + projectId（从 projectKernel 获取）
  → POST /api/v1/narrative/regen-spec
  → 后端：
    1. 从 projectId 读取 executionResults.plotBlueprint.scenes[].script
    2. 拼接剧情上下文 + 当前卡片数据 → 注入对应 Agent prompt
    3. 调用 LLM（用户配置的模型）
    4. 返回优化后的 imagePrompt / description
  → 前端更新卡片字段
```

关键改进：不再依赖 `localStorage.getItem('current_story_text')`，改为后端自动从 DB 读取 plotBlueprint，解决了"优化提示词"导致画面与剧本无关的根本问题。

---

## 第三章 运行时原理

### 3.1 唯一执行入口 —— SEEL 锁

所有 AI 生成任务收敛到**唯一入口**：

```
Frontend (capability only)
  → /api/tasks/ai-generate (SEEL - Single Entry Execution Lock)
  → BullMQ Queue (ai-runtime)
  → Worker Runtime → ModelAdapterRegistry → MSAL → Provider SDK
```

这条宪法保证：
1. **无旁路执行** — 所有任务经过同一入口
2. **无硬编码路由** — 入口不决定用什么模型，只负责转发
3. **无 Silent Fallback** — 失败直接抛错，零回退零兜底

### 3.2 ModelAdapterRegistry —— 模型适配器注册表

这是执行层的核心调度组件。所有模型调用走矩阵路由：

```typescript
// 适配器接口
interface ModelAdapter {
  execute(runtime: RuntimePayload, model: string, input: unknown): Promise<unknown>;
}

// 注册表 — 精确/前缀匹配
class ModelAdapterRegistry {
  register(name: string, adapter: ModelAdapter, options?: { priority?: number });
  execute(model: string, input: unknown, provider: string, taskType: string);
  freeze(); // boot 后冻结，禁止运行时注册
}
```

**新增模型流程（禁止硬编码宪法）**
1. 写适配器实现 `ModelAdapter` 接口
2. `register()` 注册到矩阵
3. 自动路由生效 — 无需改动业务代码

### 3.3 Provider Middleware —— 视频 body 统一构建

视频模型调用前经过 `provider-middleware.ts`，根据模型名前缀自动选择 body 格式：

| 模型前缀 | 格式 | 说明 |
|---------|------|------|
| `wan2.7-i2v` | `input.media[{type:"first_frame"}]` | 图生视频 |
| `wan2.6-*` | `input.img_url + audio_url + shot_type` | 旧版兼容 |
| `wan2.7-r2v` | `input.media[{type:"reference_image"}]` | 参考图视频 |
| `t2v-standard` | prompt only | 文生视频 |

新增视频模型只需在 `VIDEO_FORMAT_MAP` 加一行映射 + `buildVideoBody` 加一个 case。

### 3.4 异步任务队列 （BullMQ）

耗时的 LLM 调用和素材生成任务放入 BullMQ 队列 `ai-runtime`：

```
任务入队（<100ms 返回 jobId）
  → Worker 轮询消费
  → 调用 ModelAdapterRegistry.execute()
  → 结果写入 DB
  → 前端通过长轮询或 SSE 获取结果
```

---

## 第四章 配置主权层（Config Sovereignty）

### 4.1 问题背景

系统之前存在三重配置冲突源：
1. **用户自配 Key（V2 表）**
2. **平台环境变量（ecosystem.config.cjs）**
3. **shell 环境变量（~/.bashrc 等）**

优先级顺序不定，导致"上一秒能用下一秒 401"的诡异问题。

### 4.2 解决方案：Config Sovereignty Layer

```
用户配置（UserModelConfigV2）
  └→ AES-GCM 加密存储
  └→ v2-resolver.ts 解密
  └→ getRuntimeConfig(userId) 单一入口
  └→ ENOUGH — 不再查 env
```

### 4.3 核心原则

- **单一事实源** — `UserModelConfigV2` 表是唯一配置源
- **零回退零兜底** — Key 未配置/解密失败直接抛错，不 fallback 到 env
- **前端只传 capability** — 前端不传 provider/endpoint/API Key，只传用户选择的模型名

---

## 第五章 导演 OS 观测层

### 5.1 因果隔离

```
Runtime (causal closed)          Observability Plane (epistemic, non-causal)
────────────────────────         ──────────────────────────────────────────
api-surface.generate()           snapshot() → diff() → interpretDrift()
  └→ 剧本拆解                    recordDiagnostics() -> 只写不读
  └→ 素材生成                    analyzeBasins() -> attractor/topology
                                 status() -> evolution + driftSemantic
```

因果隔离已证明：
- `diagnostics/` 零外部依赖
- `recordDiagnostics()` 异常不传播
- interpretation 纯函数
- recorder 只写不读
- basin 不在任何运行时路径中

### 5.2 三时间尺度系统

| 尺度 | 机制 | 修改目标 |
|------|------|---------|
| Fast | adapt() + anchor() | 系数值 C |
| Medium | 震荡检测 + autoRelax | admissible boundary |
| Slow | meta-drift + snapshot | 不修改，只记录 |

### 5.3 5 类语义漂移

观测层将运行时状态归类为 5 种语义类型：

1. **stable** — 系统稳定，零漂移
2. **creative_exploration** — 创造性探索，受控偏移
3. **constraint_loosening** — 约束松弛，边界扩大
4. **semantic_shift** — 语义偏移，需要关注
5. **structural_instability** — 结构性不稳定，可能异常

---

## 第六章 不可逾越的宪法

系统经过多次架构重构和故障修复后，总结出以下不可违反的宪法：

### 6.1 宪法列表

| 宪法 | 描述 | 来源 |
|------|------|------|
| **禁止硬编码** | 所有 provider/模型/API/端点从数据库读 | 用户明确要求 |
| **用户前端作业规则** | 必须用用户自配 Key，严禁 fallback 到平台 Key | 用户明确要求 |
| **零回退零兜底** | 失败直接抛错，不 catch 不重试不换模型 | 用户明确要求 |
| **SEEL 唯一入口** | 所有 AI 任务收敛到 `/api/tasks/ai-generate` | 架构决定 |
| **SAMSP** | 全系统只有 MSAL 决定"用哪个模型" | 架构决定 |
| **ETFL** | EXECUTION DOMAIN 必须经 SEEL；ORCHESTRATION 只产出 plan | 架构决定 |
| **Governance LOG_ONLY** | 不阻断 execution | 架构决定 |
| **execution ≠ truth** | Truth 经仲裁后独立存储 | 架构决定 |

### 6.2 宪法实施

- Phase 1（Runtime Decontamination） — 移除匿名/ALS/RuntimeContext 降级
- Phase 2（Boot & Determinism） — 冻结注册表 boot 后不可变
- Phase 3（Self-Test） — 5 项自测（Adapter/Provider/Routing/Queue/Regression）
- Phase 4（Convergence） — 单执行路径 `execute(runtime, model, input)`
- Phase 5-7（Governance + Kernel + Truth） — 非阻塞治理层 + 事件溯源 + 仲裁

---

## 第七章 总结

影剧厂（昆仑镜）系统的核心设计理念可以概括为：

1. **单一事实源** — 剧情上下文从 DB 的 plotBlueprint 读取，配置从 UserModelConfigV2 读取，消除多源冲突
2. **矩阵路由** — 所有 AI 调用通过 ModelAdapterRegistry 匹配，新增模型只需写适配器注册
3. **因果隔离** — 运行时封闭，观测层只记录不干预，保证运行时确定性
4. **宪法治理** — 通过编码实施的硬约束保证系统行为符合设计原则

系统当前处于 **Production Observation Phase**，核心代码已冻结，工作重心转向收集生产 traces、验证 attractor hypothesis、优化用户体验。

---

## 附录

### A. 核心文件索引

| 路径 | 功能 | 行数 |
|------|------|------|
| `src/routes/narrative-llm.ts` | AI 拆解 + regen-spec 路由 | 1,159 |
| `src/runtime/narrative-gateway.ts` | LLM 调用网关 | 731 |
| `src/agents/aigc-orchestrator.ts` | 4 阶段工作流编排 | 579 |
| `src/director-v2/diagnostics/director-field.ts` | 导演场论观测层 | 1,506 |
| `src/director-v2/runtime/api-surface.ts` | 4 入口（generate/status/preview/refine） | 741 |
| `src/config-runtime/` | 配置主权层（6 文件） | ~1,000 |
| `src/model-adapters/` | 模型适配器注册表 | ~2,000 |

### B. 技术债务

- `worker-runtime.ts` 包含 legacy handler 路径（type error 17 个，pre-existing，不阻塞构建）
- `director-v2` 67 文件保留（67 文件，运行时活跃，部分文件可归档到观测层）
- 前端旧 JS chunk 缓存用户需要 Ctrl+F5 硬刷新
- `scheduler.ts` 语法错误（tsc 已容忍，不影响构建）

---

*论文撰写日期：2026-05-26 | 系统版本：Production v2.5*
