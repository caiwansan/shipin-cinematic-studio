# 🎬 影剧厂 / shipin-cinematic-studio — 架构说明书

> **版本**: 1.0 · 2026-06-01
> **项目**: AI 短剧制作工作台（线上版）
> **DB**: `aigc_scs` (PostgreSQL) · **端口**: 后端 4002 / 前端 4001
> **管理工具**: `pm2` · **运行时**: Node.js 22 + tsx (--experimental-default-type=commonjs)

---

## 目录

1. [系统分层架构](#1-系统分层架构)
2. [技术栈](#2-技术栈)
3. [目录结构](#3-目录结构)
4. [核心流程](#4-核心流程)
5. [Provider 适配器体系](#5-provider-适配器体系)
6. [配置系统](#6-配置系统)
7. [数据库](#7-数据库)
8. [前端架构](#8-前端架构)
9. [启动与运维](#9-启动与运维)
10. [已知问题与约束](#10-已知问题与约束)

---

## 1. 系统分层架构

```
┌─────────────────────────────────────────────────────────┐
│  📱 UI Projection Layer（前端投影层）                     │
│  Nuxt 3 pages/ · studio-v2/ · components/ · stores/     │
│  职责：展示 → 提交任务 → 展示结果，不拥有执行裁决权        │
├─────────────────────────────────────────────────────────┤
│  🎯 API Surface（路由层）                                 │
│  Fastify routes/ · middleware/ · plugins/                │
│  职责：路由分发、JWT 鉴权、输入校验、请求上下文            │
├───────────────────────核心运行时─────────────────────────┤
│  🧠 Showrunner Cognition（导演认知层）                    │
│  director-v2/ · crfl/ · norm/ · dpm/ · constitution     │
│  职责：叙事理解、情绪分析、宪法约束、导演决策              │
├─────────────────────────────────────────────────────────┤
│  ⚙️ Runtime Core（运行时核心）                            │
│  runtime/ · execution/ · kernel/ · llm-execution-graph  │
│  职责：Provider 路由、执行编排、状态管理、容错降级          │
├─────────────────────────────────────────────────────────┤
│  🔧 Execution / Worker（执行层）                         │
│  production-loop/ · workers/ · jobs/ · workflow/        │
│  职责：图片/视频/TTS 生9成、合成导出、后台任务             │
├─────────────────────────────────────────────────────────┤
│  📦 Persistence Layer（持久化层）                         │
│  PostgreSQL · Prisma · JSONB 半结构化存储                │
└─────────────────────────────────────────────────────────┘
```

### 架构原则（Runtime 宪法）

| 原则 | 说明 |
|------|------|
| DB 是唯一真相源 | 所有持久化状态只信任数据库，UI/localStorage/cache 只是投影 |
| UI 不拥有执行权 | 前端只展示状态和提交流程请求，不裁决状态、不做重试编排 |
| Stage 状态是推导的 | 状态由上游依赖 + worker 执行结果共同决定，前端不能直接设置 |
| Worker 独占 Provider 执行 | 只有 worker 才有权限调用 AI provider，API 层发起任务排队 |

---

## 2. 技术栈

| 层 | 技术 |
|----|------|
| **后端框架** | Fastify + TypeScript (Node 22, tsx transpile-only) |
| **数据库** | PostgreSQL 16 (Prisma ORM + raw JSONB) |
| **前端框架** | Nuxt 3 (Vue 3 + Nitro Server) |
| **鉴权** | JWT (@fastify/jwt) + 验证码 + 短信 |
| **LLM** | 阿里百炼 DashScope (qwen3.6-flash) |
| **图片生成** | 火山引擎万相 / MiniMax / 硅基流动 / ComfyUI |
| **视频生成** | 火山引擎 WAN / MiniMax / 阿里通义 / Vidu |
| **TTS** | 火山引擎 CosyVoice / MiniMax / 阿里 / 硅基流动 |
| **进程管理** | pm2 (fork mode, Node 22 CJS/ESM 兼容补丁) |

---

## 3. 目录结构

```
/root/shipin-cinematic-studio/
├── backend/
│   └── src/
│       ├── index.ts              # 🚀 入口：Fastify 初始化 + 路由注册
│       │
│       ├── routes/               # 📡 API 路由（约 45+ 文件）
│       │   ├── narrative-llm.ts  # 六维拆解 analyze-v2
│       │   ├── projects.ts       # 项目 CRUD
│       │   ├── scenes.ts         # 场景
│       │   ├── storyboards.ts    # 分镜
│       │   ├── ai-tasks.ts       # AI 任务（生产耗用）
│       │   ├── images.ts         # 图片生成 API
│       │   ├── tts.ts / voice.ts # 配音
│       │   ├── pipeline-jobs.ts  # 管线任务
│       │   ├── payment.ts        # 支付
│       │   ├── models.ts         # 模型查询
│       │   ├── api-keys.ts       # API Key
│       │   └── admin-*.ts / community/  # 后台/社区
│       │
│       ├── runtime/              # ⚡ 运行时核心
│       │   ├── narrative-gateway.ts   # 叙事网关（LLM 调用）
│       │   ├── runtime-gateway.ts     # 通用运行时网关
│       │   ├── providers/             # Provider 注册表
│       │   ├── provider-state/        # Provider 状态管理
│       │   ├── trace/                 # 运行时追踪
│       │   └── degrade-engine.ts      # 降级引擎
│       │
│       ├── llm-execution-graph-v2/ # 🔗 LLM 执行图编排
│       │   ├── graph-builder.ts    # 构建执行图（config → provider 路由）
│       │   ├── executor.ts         # 执行图执行
│       │   └── trace/              # 执行追踪
│       │
│       ├── config-runtime/         # ⚙️ 统一配置入口
│       │   ├── runtime.ts          # getRuntimeConfig() 核心
│       │   ├── bootstrap.ts        # 系统配置引导
│       │   ├── v2-resolver.ts      # V2 配置表解析
│       │   └── types.ts            # 配置类型
│       │
│       ├── model-adapters/         # 🔌 模型适配器（生产级）
│       │   ├── llm/    — volcengine / bailian / deepseek / ollama
│       │   ├── images/ — volcengine / minimax / siliconflow / openai / gemini / ali
│       │   ├── video/  — volcengine / minimax / ali / vidu
│       │   └── tts/    — volcengine / minimax / siliconflow / ali
│       │
│       ├── director-v2/            # 🎬 导演系统 v2
│       │   ├── runtime/api-surface.ts  # 4 个生产入口（generate/preview/refine/status）
│       │   ├── cinematic-compiler/     # 编译管线
│       │   ├── constitution-compiler.ts# 宪法编译
│       │   ├── crfl/                   # 连续理性形式语言
│       │   ├── diagnostics/            # 系统诊断
│       │   ├── norm/                   # 规范化
│       │   ├── dpm/ dpm-v2/            # 决策过程模型
│       │   ├── render/                 # 渲染引擎（prompt 编译/时间维度）
│       │   └── schema/                 # 宪法 schema
│       │
│       ├── core/                  # 🧠 核心层
│       │   ├── agent-graph/       # Agent 图
│       │   ├── constraint-physics/ # 约束物理
│       │   ├── style-evolution/   # 风格演化
│       │   ├── runtime/           # 核心运行时
│       │   ├── autonomous/        # 自治调度
│       │   └── cluster/           # 集群管理
│       │
│       ├── kernel/                # 🔧 内核
│       │   ├── dag/               # DAG 执行
│       │   ├── event-sourcing/    # 事件溯源
│       │   └── replay/            # 回放
│       │
│       ├── control-plane/         # 🎛️ 控制平面
│       ├── governance/            # 🛡️ 治理（审计/成本/限流/租户）
│       ├── plugins/               # 🔌 Fastify 插件
│       │   ├── cors.ts / auth.ts / runtime-context.ts
│       ├── payment/               # 💳 支付（支付宝/微信）
│       ├── production-loop/       # 🏭 生产循环（视频生成）
│       ├── services/              # ⚙️ 业务服务（社区/音乐/叙事）
│       └── workers/               # 🏗️ 工作进程
│
├── frontend/
│   ├── pages/                     # Nuxt 页面
│   │   ├── index.vue / login.vue / projects.vue / v2.vue
│   │   ├── studio/                # 旧版 Studio
│   │   ├── admin/                 # 后台管理
│   │   ├── community/             # 社区
│   │   └── user/                  # 用户中心
│   │
│   ├── studio-v2/                 # 🎯 新版制作工作台 v2
│   │   ├── workspace/             # 工作空间组件
│   │   │   ├── script-analysis    # 剧本分析
│   │   │   ├── character-design   # 角色设计
│   │   │   ├── scene-design       # 场景设计
│   │   │   ├── storyboard         # 分镜设计
│   │   │   ├── props-design       # 道具设计
│   │   │   ├── director           # 导演面板
│   │   │   ├── specification      # 规格视图
│   │   │   └── video-generation   # 视频生成
│   │   ├── pipeline/              # 流水线
│   │   ├── runtime/               # 运行时（asset-binding / director-ai / execution）
│   │   ├── stores/                # 状态管理
│   │   └── pages/studio-v2.vue    # 入口
│   │
│   ├── kernel/                    # 🧬 前端内核
│   │   ├── runtime-kernel.ts      # 运行时内核
│   │   ├── dual-run/              # 双轨运行
│   │   ├── shadow/                # 影子模式
│   │   ├── event-bus/             # 事件总线
│   │   ├── scheduler/             # 调度器
│   │   ├── state-tree/            # 状态树
│   │   ├── cutover/               # 切换
│   │   └── lifecycle/             # 生命周期
│   │
│   ├── services/                  # 前端服务层
│   ├── stores/                    # Pinia Stores
│   ├── composables/               # Vue Composables
│   └── server/                    # Nitro Server 路由
│
└── backups/                       # 代码备份
```

---

## 4. 核心流程

### 4.1 六维 AI 拆解（项目入口）

```
用户提交剧本
  │
  ▼
POST /api/v1/narrative/analyze-v2
  │
  ├─→ ① 尝试 AI (阿里百炼 qwen3.6-flash)
  │   ├─→ narrative-gateway.ts → buildExecutionGraph
  │   │   → getRuntimeConfig(userId) → 解析用户配置
  │   │   → 路由到对应 provider (aliyun/volcengine)
  │   │   → 调用 LLM
  │   └─→ 返回 { videoSegments, characters, scenes, beats, dialogues, ... }
  │
  └─→ ② 若 AI 失败/超时 → 启发式 fallback
      └─→ heuristicAnalyzeV2(script, title, duration)
          → normalizeNarrativeSpec() → 本地正则切分
          → 返回六维数据
  │
  ▼
写入 Project.execution_results.analyzeV2Data → { version, createdAt, normalized, rawAiResponse, ... }
  │
  ▼
返回 { success: true, data: { videoSegments, characters, scenes, ... } }
```

### 4.2 制作流水线

```
 [六维拆解结果] → [角色设定] → [场景设定] → [分镜拆解]
          → [图片生成] → [视频生成] → [TTS配音] → [音画合成] → [成片导出]

 步骤            | 主要 API                           | Provider 选择
 ────────────────|────────────────────────────────────|──────────────────────
 角色设定+形象图  | POST /api/ai-tasks + POST /api/scenes | LLM (分析) + 图片模型
 场景图生成       | POST /api/scenes                     | 图片模型
 分镜拆解         | POST /api/storyboards                 | LLM (分析)
 图片生成         | POST /api/v1/images                   | 火山/MiniMax/硅基流动/ComfyUI
 视频生成         | POST /api/v1/ai-tasks                 | 火山/MiniMax/阿里/Vidu
 TTS 配音         | POST /api/v1/tts / voice              | 火山/MiniMax/硅基流动/阿里
 音画合成         | POST /api/v1/pipeline-jobs            | ffmpeg (本地)
 成片导出         | POST /api/v1/pipeline-jobs            | ffmpeg (本地)
```

### 4.3 执行图（ExecutionGraph）流程

```
用户请求 (含 userId, projectId)
  │
  ▼
buildExecutionGraph({ userId, projectId })
  ├─→ getRuntimeConfig(userId) → 解析配置
  │   ├── system: 系统默认配置 (frozen 面板)
  │   └── user: { provider, model, apiKey, source } — 来自 UserModelConfigV2
  │
  ├─→ 注册执行节点
  │   ├── Node 1: config_resolve — 配置解析
  │   ├── Node 2: llm_call — LLM 调用
  │   └── Node 3: final — 聚合结果
  │
  ├─→ provider 路由（匹配 models[0]）
  │   └── 例：aliyun → qwen3.6-flash
  │
  └─→ 执行 → 返回 GatewayResponse
```

---

## 5. Provider 适配器体系

### 5.1 运行时网关层（src/runtime/providers/）

轻量级 provider 注册表，基于 OpenAI 兼容协议：

| Provider | 提供商 | 支持模型 |
|----------|--------|----------|
| bailian | 阿里百炼 DashScope | `qwen3.6-flash`, `qwen-plus`, `qwen-max` |
| volcengine | 火山引擎 | `doubao-seed-2-0-plus-260428` |
| deepseek | DeepSeek | `deepseek-chat` |
| minimax | MiniMax | `abab7`, `minimax-text-01` |
| siliconflow | 硅基流动 | `Pro/deepseek-ai` |
| google | Google | `gemini` |
| baidu | 百度 | `ernie` |
| comfyui | ComfyUI | (自定义) |

### 5.2 生产适配器层（src/model-adapters/）

面向生产耗用的适配器接口：

```typescript
interface ImageProviderAdapter {
  provider: string
  buildGenerateRequest(config, record): ProviderRequest
  parseGenerateResponse(result): { isAsync, taskId?, imageUrl? }
  buildPollRequest(config, taskId): ProviderRequest
  parsePollResponse(result): { status, imageUrl?, error? }
  extractImageUrl(result): string | null
}
```

类似接口适用 `video` / `tts` / `llm`。

### 5.3 用户配置优先级

```
UserModelConfigV2.llmProvider  →  v2-resolver.ts  →  getRuntimeConfig(userId)
  ↑ 用户未配置 → 系统默认配置 (bootstrap.ts → start-aigc.sh 环境变量)
```

---

## 6. 配置系统

### 6.1 配置解析流程

```
UserModelConfigV2 (DB)               # 用户自定义
    ↓
v2-resolver.ts → resolveUserLLMConfig()
    ↓
getRuntimeConfig() → 合并 system config
    ↓
buildExecutionGraph() → Provider 路由
```

### 6.2 系统配置来源

- 环境变量（`start-aigc.sh`）：`ALIYUN_API_KEY`, `ALIYUN_LLM_MODEL`
- DB 系统配置表：`PromptTemplate`, `SystemMonitor`, `AiModel`, `ModelProvider`
- `config-runtime/bootstrap.ts` 引导时加载

---

## 7. 数据库

### 7.1 核心表

| 表 | 行数(约) | 说明 |
|----|---------:|------|
| Project | — | 项目（含 `execution_results` JSONB 存六维拆解结果）|
| User | — | 用户 |
| UserModelConfigV2 | 24 | 用户 AI 配置（llm/image/video/tts provider+model+key）|
| ApiKey | 3 | API 密钥 |
| PromptTemplate | 2 | 提示词模板（name/description/content/jsonb variables）|
| Character | — | 角色分析结果 |
| Scene | — | 场景分析结果 |
| VideoSegment | — | 视频段落 |
| Storyboard | — | 分镜 |
| WorkflowDef / TaskExecution / PipelineJob | — | 工作流/任务 |
| AiModel / ModelProvider | — | 模型注册表 |
| Asset / AssetDna / AssetGraphEdge / CreatorWallet | — | 资产经济系统 |

总表数：**120+ 张表**（含 Prisma migrations、社区、支付、治理等）

### 7.2 Project 表关键字段

```
id              UUID PRIMARY KEY
name            TEXT NOT NULL
description     TEXT
status          TEXT NOT NULL (draft/published/etc)
userId          UUID NOT NULL FK→User
execution_results  JSONB  → { analyzeV2Data: { version, normalized, ... }, ... }
script          TEXT          # 原始剧本
plot_blueprint  JSONB         # 情节蓝图
createdAt / updatedAt
```

### 7.3 UserModelConfigV2 表关键字段

```
userId          UUID PK FK→User
llmProvider     TEXT DEFAULT 'volcengine'
llmModel        TEXT DEFAULT 'doubao-seed-2-0-plus-260428'
llmApiKey       TEXT
llmEnabled      BOOLEAN DEFAULT true
imageProvider   TEXT / imageModel / imageApiKey / imageEnabled
videoProvider   TEXT / videoModel / videoApiKey / videoEnabled
ttsProvider     TEXT / ttsModel / ttsApiKey / ttsEnabled
```

---

## 8. 前端架构

### 8.1 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | index.vue | 首页/落地页 |
| `/login` | login.vue | 登录 |
| `/projects` | projects.vue | 项目列表 |
| `/v2` | v2.vue | Studio v2 入口 |
| `/studio-v2` | studio-v2.vue | 新版制作工作台 |
| `/admin/*` | admin/ | 后台管理 |
| `/community/*` | community/ | 社区 |
| `/user/*` | user/ | 用户中心 |

### 8.2 Studio v2 工作空间

```
studio-v2/workspace/
├── script-analysis/     剧本分析面板
├── character-design/    角色设计面板
├── scene-design/        场景设计面板
├── storyboard/          分镜面板
├── props-design/        道具设计面板
├── director/            导演面板（镜头强度/情绪风格/生成模型）
├── specification/       规格视图
├── video-generation/    视频生成面板
└── WorkspaceRenderer.vue  总渲染器
```

### 8.3 前端状态管理

```
stores/ (Pinia)
├── auth.ts            # 认证
├── project.ts         # 项目
├── projectStore.ts    # 项目存储
└── community/         # 社区状态

kernel/ (前端运行时内核)
├── runtime-kernel.ts  # 主内核入口
├── dual-run/          # 新旧并行运行
├── shadow/            # 影子模式
├── event-bus/         # 事件总线
├── scheduler/         # 调度器
├── state-tree/        # 状态树
├── cutover/           # 版本切换
└── lifecycle/         # 生命周期
```

---

## 9. 启动与运维

```bash
# 后端
cd /root/shipin-cinematic-studio/backend

# 启动（首次或重启）
pm2 delete api-server-aigc 2>/dev/null; pm2 start start-aigc.sh --name api-server-aigc

# 查看日志
pm2 logs api-server-aigc --lines 20

# 健康检查
curl http://localhost:4002/api/health

# 环境变量（start-aigc.sh）
export ALIYUN_API_KEY="sk-xxxxx"
export ALIYUN_LLM_MODEL="qwen3.6-flash"
```

### 清理 tsx 缓存

修改源码后需清理 tsx 缓存才能生效：
```bash
rm -rf /root/.cache/tsx ~/.cache/tsx
pm2 restart api-server-aigc
```

---

## 10. 已知问题与约束

### 10.1 运行时约束

| # | 约束 | 说明 |
|---|------|------|
| 1 | 禁止硬编码 provider/model | 所有配置从 DB 读取或环境变量注入 |
| 2 | UI 不拥有执行裁决权 | 前端不可直接设置 stage 状态 |
| 3 | DB 是唯一真相源 | localStorage/cache 仅做投影 |

### 10.2 已知问题

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | 阿里百炼免费额度耗尽 | 仅 `qwen3.6-flash` 可用 | ⚠️ 需充值 |
| 2 | TS 类型错误 ~30 个 | director-v2/ 目录，运行时跳过类型检查不影响线上 | 🟡 已知 |
| 3 | 前端 pm2 重启 362+ 次 | Nuxt HMR/lifecycle 不稳定 | 🟡 观察中 |
| 4 | 存在废弃代码 | sql 年前已清理约 10,300 行，仍有少量残留 | 🔄 持续 |

### 10.3 版本状态

| 项目 | 后端 | 前端 |
|------|------|------|
| 源文件数 | 521 | 241 |
| 代码行数 | ~81K | ~43K |
| PM2 进程 | api-server-aigc (端口 4002) | frontend (端口 4001) |
| 启动方式 | tsx transpile-only | nitro server |

---

*本文档与 `docs/architecture/` 下的系统收敛宪法 (system-convergence-constitution.md) 保持一致。*
*关于死亡层标记和执行拓扑详见 `docs/architecture/death-layer-map.md` 和 `runtime-topology.md`。*
