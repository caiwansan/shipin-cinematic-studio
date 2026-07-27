# CREATIVE-PLATFORM-V1-CAPABILITY-MAP.md

> **版本：v1.1 | 创建：2026-07-21 | 修正：2026-07-21 | CTO 批准：STUDIO-ARCH-03 Phase 2.1**

---

## 一、能力分层

```
┌─────────────────────────────────────────────────────┐
│                  昆仑镜 产品层                         │
│         Product Layer（导航 / 路由 / UI）              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 短剧      │  │ 音乐      │  │ 广告      │  ← Workspace │
│  │ Workspace │  │ Workspace │  │ Workspace │     (领域专属) │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │              │              │                │
│  ┌────┴──────────────┴──────────────┴────┐          │
│  │        Creative Platform Core          │  ← Core  │
│  │  Project / Brief / Plan / Asset / ... │  (共享)   │
│  └────────────────┬──────────────────────┘          │
│                   │                                  │
│  ┌────────────────┴──────────────────────┐          │
│  │          Runtime Layer                 │  ← Runtime│
│  │  Pipeline / Task / AI Gateway / Cost   │  (冻结)   │
│  └───────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## 二、能力归属清单

### 2.1 Product Layer — Workspace 专属

| 能力 | 短剧 Workspace | 音乐 Workspace | 广告 Workspace |
|------|:---:|:---:|:---:|
| 创作类型卡片 | ✅ | ✅ | ✅ |
| 创意输入 UI | ✅ | ✅ | ✅ |
| 风格选择器（9种画风） | ✅ | ❌ | ✅ |
| 情绪/BPM 选择器 | ❌ | ✅ | ❌ |
| 画面比例选择 | ✅ | ❌ | ✅ |
| 集数/场景/镜头方案 | ✅ | ❌ | ❌ |
| 时长/BPM 方案 | ❌ | ✅ | ✅ |
| 镜头数方案 | ✅ | ❌ | ✅ |
| 5 阶段 Pipeline 进度 | ✅ | ❌ | ❌ |
| 2 阶段 Pipeline 进度 | ❌ | ❌ | ✅ |
| 1 阶段 Pipeline 进度 | ❌ | ✅ | ❌ |
| 歌词编辑器 | ❌ | ✅ | ❌ |

### 2.2 Product Layer — 路由

| 路径 | 类型 | 能力 |
|------|------|------|
| `/studio/v2` | 工作台（短剧） | 导演工作台（成熟产品入口） |
| `/studio/v2?project=xxx` | 工作台（短剧） | 导演工作台（带项目 ID） |
| `/workspace/music` | 工作台（音乐） | 音乐创作空间（独立入口，含用户体系 + 大模型设置 + CostCenter + Team + Asset） |
| `/workspace/ad-create` | 工作台（广告） | 广告制作空间（独立入口，含用户体系 + 大模型设置 + CostCenter + Team + Asset） |

> **设计原则**：已有成熟产品入口保持不变，新领域通过 Launcher 创建后进入独立 Workspace。
>
> **产品优先级**：`已有产品稳定运行 > 领域拆分 > 平台抽象`
> 不要为了未来的平台架构，把已经能卖的产品重新改造成架构实验。

### 2.3 Core — 共享服务（不拆分）

| 能力 | 归属 | 文件 | 说明 |
|------|------|------|------|
| 项目管理 | Core | `Project` 模型 | 所有领域共享 |
| 创意输入 | Core | `CreativeBrief` 模型 | `creativeParams` JSON 承载领域差异 |
| 制作方案 | Core | `ProductionPlan` 模型 | `plan_data` JSON 承载领域差异 |
| 资产管理 | Core | `Asset` 模型 | 所有领域共享 |
| 视频任务 | Core | `VideoTask` 模型 | 所有领域共享 |
| 任务队列 | Core | `pipeline-jobs.ts` | 单队列，按领域标记 |
| AI 网关 | Core | `narrative-gateway.ts` | 跨供应商 fallback |
| 模型路由 | Core | `ai-router.service.ts` | 统一路由 |
| 成本计算 | Core | `AiModel` 定价 | 统一计算 |
| 团队协作 | Core | `StudioProjectMember` | 统一权限 |
| 导出 | Core | `StudioExport` | 统一导出 |

### 2.4 Runtime — 冻结层（禁止变更）

| 能力 | 文件 | 状态 |
|------|------|------|
| Pipeline Engine | `pipeline.ts` | ❌ 冻结 |
| Task Queue | `pipeline-jobs.ts` | ❌ 冻结 |
| Narrative Gateway | `narrative-gateway.ts` | ❌ 冻结 |
| AI Gateway | `unified-ai-gateway.ts` | ❌ 冻结 |
| Model Router | `ai-router.service.ts` | ❌ 冻结 |
| Asset Service | Asset 模型 | ❌ 冻结 |
| Cost Engine | `AiModel` 定价 | ❌ 冻结 |
| Auth / RBAC | `auth.ts` | ❌ 冻结 |

---

## 三、扩展新领域指南

未来增加新领域（动画、游戏CG、教育视频）只需：

### 需要新建
1. `workspace-config.ts` → 添加 WorkspaceConfig
2. `[Domain]Workspace.vue` → 领域 UI
3. `[Domain]Layout.vue` → 布局包装器
4. 更新 `projectTypes` 列表（launcher + navigation.ts）

### 不需要新建
- ❌ 新数据模型
- ❌ 新 Pipeline
- ❌ 新权限系统
- ❌ 新 Asset 类型
- ❌ 新 Cost 引擎
- ❌ 新 Export 系统
- ❌ 新 Team 系统

### 流程
```
新领域 → workspace-config.ts → WorkspaceConfig
       → [Domain]Workspace.vue → 领域 UI
       → [Domain]Layout.vue → 包装 DirectorProgress + CostCenter + TeamPanel
       → navigation.ts → 添加导航入口
       → launcher projectTypes → 自动支持
       → 零 Core / Runtime 变更
```

---

## 四、路由安全规则

### 导航入口规则
| 规则 | 说明 |
|------|------|
| ✅ 导航可访问 `/studio/create?type=xxx` | 创建入口 |
| ✅ 导航可访问 `/studio/` | Launcher 首页 |
| ❌ 导航不可直接访问 `/workspace/music` | 无 projectId，无意义 |
| ❌ 导航不可直接访问 `/workspace/ad-create` | 无 projectId，无意义 |
| ✅ 导航可访问 `/studio/v2` | 短剧工作台（兼容入口） |

### Workspace 页面规则
| 规则 | 说明 |
|------|------|
| ✅ `/workspace/music/:projectId` | 正常访问 |
| ✅ `/workspace/ad-create/:projectId` | 正常访问 |
| ✅ `/workspace/mv/:projectId` | 正常访问 |
| ❌ `/workspace/music` (无 ID) | 跳回 `/studio/create?type=music` |
| ❌ `/workspace/ad-create` (无 ID) | 跳回 `/studio/create?type=ad` |

---

## 五、数据流

```
用户点击「音乐创作」
    ↓
/studio/create?type=music
    ↓
Launcher 自动选中 MUSIC → 显示音乐输入界面
    ↓
POST /api/v1/studio/create-work {projectType:MUSIC, ...}
    ↓
CreativeBrief.creativeParams = {mood, bpm, instruments}
    ↓
ProductionPlan.plan_data = {totalTime, bpm, mood, workflow:[music]}
    ↓
Redirect → /workspace/music/:projectId
    ↓
MusicWorkspaceLayout → MusicGenerationWorkspace
    ↓
创作 → Asset → Cost → Team → Export
```

---

## 六、产品形态

v0.1 三领域：
```
昆仑镜
├── 🎬 短剧 → 导演工作台 (5阶段 Pipeline)
├── 🎵 音乐 → 音乐创作台 (歌词→音乐)
└── 📢 广告 → 广告制作台 (脚本→分镜→视频)
```

v0.2 扩展（零 Core 变更）：
```
昆仑镜
├── 🎬 短剧
├── 🎵 音乐
├── 📢 广告
├── 🎮 游戏CG    ← 仅加 3 个文件
├── 📚 教育视频   ← 仅加 3 个文件
└── 🏢 企业视频   ← 仅加 3 个文件
```

---

## 七、STUDIO-ARCH-03 阶段状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 0: Domain Freeze | ✅ 完成 | 三领域边界冻结 |
| Phase 1: Core Separation | ✅ 完成 | 共享 Core 层冻结 |
| Phase 2: Workspace Separation | ✅ 完成 | 三工作台独立 |
| Phase 2.1: Route Correction | ✅ 完成 | 短剧保留原入口，音乐/广告走 Launcher |
| Phase 3: Workflow Resolver | ⏸ 暂停 | 优先产品验证，不做架构抽象 |

### 冻结清单
- `/studio/v2` 短剧入口 — 永久冻结，不做路由变更
- Core 层 — 冻结，新领域只加 Workspace
- Runtime 层 — 冻结，禁止变更

### 产品优先级
```
已有产品稳定运行 > 领域拆分 > 平台抽象
```

> 短剧工作台 `/studio/v2` 是成熟产品入口，不经过任何新建流程。
> 音乐 `/workspace/music` 和广告 `/workspace/ad-create` 是从短剧工作台侧边栏拆出的独立工作台。
任何未来改造必须通过：
1. 是否影响已有用户路径？
2. 是否影响已验证产品？
3. 是否真的解决商业问题？

---

> Phase 2.1 已于 2026-07-21 经 CTO Review 通过。
> 下一步：STUDIO-BETA-PRODUCT-VERIFY（产品验证，非架构改造）。
