# 昆仑镜 V4 平台架构宣言

> **版本**: v1.0 · 状态: **架构基线 (C0)** · 日期: 2026-07-18
> **签署人**: 熊大（产品架构师）
> **约束力**: 本宣言为平台架构宪法，所有 PR 必须符合本宣言规定方可合并

---

## 规范架构图

这是昆仑镜 V4 的唯一规范架构。任何与下图不符的实现均为违规实现。

```
┌──────────────────────────────────────────────────────────┐
│                    Studio Platform                        │
│  ┌──────┐ ┌────┐ ┌──────┐ ┌──────┐ ┌───┐ ┌──────┐      │
│  │ Auth │ │Proj│ │Asset │ │Wkflow│ │Rtn│ │Stor  │ SDK   │
│  │  Mbr │ │ject│ │Center│ │Engine│ │ime│ │age   │       │
│  └──────┘ └────┘ └──────┘ └──────┘ └───┘ └──────┘      │
└──────────────────────┬───────────────────────────────────┘
                       │ WorkspaceAdapter
          ┌────────────┼────────────┬────────────┐
          ▼            ▼            ▼            ▼
     ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  ...
     │  GEO   │ │ Video  │ │  Novel │ │  PPT   │
     └────────┘ └────────┘ └────────┘ └────────┘
          │            │            │            │
          ▼            ▼            ▼            ▼
     ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
     │Knowledge││ Story  ││Presentation│ Brand │  Domain
     └────────┘ └────────┘ └────────┘ └────────┘
                        │
                        ▼
          ┌──────────────────────────┐
          │  Provider Layer          │
          │  OpenAI DeepSeek Qwen    │
          │  Doubao Gemini Local     │
          └──────────────────────────┘
```

---

## 1. 核心原则

### 原则一：Platform First

**平台层是第一公民**。Workspace 层是第二公民。Domain 层是第三公民。

这意味着：
- 所有通用能力必须实现在 Platform 层，不允许在 Workspace 层重复实现
- Workspace 层只能通过 Platform SDK 访问通用能力
- Domain 层只能被 Workspace 层调用，不能反向依赖
- Provider 层完全对 Workspace 透明

### 原则二：Workspace 是薄壳

Workspace 不拥有运行时、不拥有认证、不拥有数据库、不拥有工作流引擎。Workspace 只拥有：
- 业务 UI 组件
- 业务 Service（通过 Platform SDK 调用后端能力）
- 业务 Store（仅状态编排，非持久化状态）
- 业务类型定义
- 领域特定的 Adapter 实现

### 原则三：Domain 是纯数据

Domain 层是纯数据模型 + 纯函数的领域逻辑。Domain 不依赖 Platform 层，不依赖任何 Provider。Domain 的定义位置在 Platform 层统一管理，命名遵循 `Knowledge*` 而非 `Geo*` 规范（见 DATA-SPEC.md）。

### 原则四：Provider 透明

Workspace 层不知道也不关心当前使用的是哪个 Provider。Provider 的选择、切换、兜底全部由 Platform 层的 Capability Runtime 负责。

---

## 2. Platform 层拥有清单

Platform 层**独家拥有**以下能力。任何 Workspace 不得重新实现。

| 能力 | 说明 | 实现位置 |
|------|------|----------|
| **Auth** | 用户认证（JWT/Session/OAuth） | `@studio/platform/auth` |
| **Membership** | 会员等级、订阅管理 | `@studio/platform/membership` |
| **Permission** | 角色、权限、资源隔离 | `@studio/platform/permission` |
| **Runtime** | 执行运行时、工作流运行时、能力运行时、状态运行时 | `@studio/platform/runtime` |
| **Project** | 项目 CRUD、生命周期、类型枚举 | `@studio/platform/project` |
| **Asset** | 资产上传、下载、类型管理 | `@studio/platform/asset` |
| **Storage** | 对象存储、本地存储、CDN | `@studio/platform/storage` |
| **Workflow Engine** | DAG 解析、调度、重试、超时 | `@studio/platform/workflow` |
| **Capability Engine** | Provider 路由、能力注册、兜底降级 | `@studio/platform/capability` |
| **SDK** | 统一 API 客户端、Repository 基类 | `@studio/platform/sdk` |
| **Event Bus** | 事件发布/订阅、跨 workspace 通信 | `@studio/platform/event` |
| **Logger** | 结构化日志、日志级别、追踪 | `@studio/platform/logger` |
| **Telemetry** | 指标收集、链路追踪、监控 | `@studio/platform/telemetry` |

---

## 3. Workspace 层禁止清单

Workspace 层**不得包含**以下任何内容：

| 禁止项 | 原因 | 替代方案 |
|--------|------|----------|
| 运行时实现（Runtime） | 运行时只能由 Platform 层提供 | 实现 `WorkspaceAdapter`，调用 Platform Runtime |
| 认证/权限/会员逻辑 | 认证是平台基础设施 | 通过 Platform SDK auth 模块 |
| `import prisma` 直接访问数据库 | 破坏 Repository 封装 | 通过 Platform SDK repository 模块 |
| `fetch()` / `axios()` 直接调用 API | 无法追踪、无法统一错误处理 | 使用 Platform SDK `apiClient` |
| scoped 的 Agent 注册表 | Agent 必须在平台注册 | 通过 Platform Agent Registry |
| 独立的工作流引擎 | 工作流引擎只有一个 | 在 Platform 注册 DAG |
| 独立的 Provider 调用 | Provider 调用必须经过 Capability Runtime | 调用 Platform SDK capability |
| 独立的 Project 表 | 项目只有一张表 | 使用 `Project.type` 枚举区分 |
| 独立的 Auth 表/User 表 | 用户只有一套 | 使用 Platform Auth |
| 自己的 mapPrisma 函数 | 导致 13 份重复代码 | 使用 `BaseRepository` 基类 |

---

## 4. Domain 层拥有清单

Domain 层**拥有**以下内容（定义在 Platform 数据层中，但语义上属于 Domain）：

| 领域 | 核心模型 | 说明 |
|------|----------|------|
| Knowledge | `KnowledgeClaim`, `KnowledgeEvidence`, `KnowledgeCitation`, `KnowledgeFAQ`, `KnowledgeSchema`, `KnowledgeQualityScore` | GEO 知识质量管线 |
| Story | `StoryBeat`, `StoryCharacter`, `StoryScene`, `StoryDialogue`, `StoryArc` | 叙事结构与剧情弧 |
| Brand | `BrandProfile`, `BrandAsset`, `BrandWebsiteScan`, `BrandVisibility` | 品牌档案与可见性 |
| Media | `MediaAsset`, `MediaDna`, `MediaRender`, `MediaMetadata` | 媒体资产与渲染 |
| Research | `ResearchTopic`, `ResearchSource`, `ResearchCitation`, `ResearchEntity` | 研究主题与实体 |

Domain 模型**禁止**：
- 依赖 Platform 层功能
- 依赖 Provider 层
- 使用 `Geo*` 前缀命名（必须迁移为 `Knowledge*`）

---

## 5. 平台八条演化规则

以下 8 条规则为**强制性策略**，所有 Workspace 开发者必须遵守。

### 规则 1：Workspace 不得实现自己的 Runtime

**禁止**: `workspace/geo/runtime/geo.runtime.ts`，`workspace/video/composables/useVideoRuntime.ts`
**允许**: `workspace/geo/adapter/GEOWorkspaceAdapter.ts` — 仅实现 `register()` / `execute()` / `dispose()`

### 规则 2：Workspace 不得实现 Auth/Permission/Membership/Storage

**禁止**: 任何 `getAuthHeaders()` 从 localStorage 读 token，任何文件系统直接操作
**允许**: 调用 `PlatformSDK.auth.verify()`，`PlatformSDK.storage.upload()`

### 规则 3：Workspace 不得 `import prisma`

**禁止**: `import { prisma } from '@/lib/prisma'`
**允许**: 继承 `BaseRepository<T>`，调用 `this.create()`, `this.update()`, `this.findMany()`

### 规则 4：Workspace 不得直接调用 `fetch()` 或 `axios()`

**禁止**: `fetch('/api/geo/projects')`, `axios.post('/api/geo/claims')`
**允许**: `PlatformSDK.api.get('/geo/projects')`, `PlatformSDK.api.post('/geo/claims')`

### 规则 5：Agent 必须在平台 Agent Registry 注册

**禁止**: 仅 workspace-scoped 的注册文件（如 `geo-registry.ts`）
**允许**: 通过 `PlatformSDK.capability.registerAgent()` 统一注册

### 规则 6：Workflow Engine 属于平台，Workspace 只配置 DAG

**禁止**: Workspace 内部实现 WorkflowBuilder/Dispatcher
**允许**: 通过 `PlatformSDK.workflow.registerDAG({ id: 'geo.knowledge-quality', nodes: [...] })`

### 规则 7：能力流为 Platform → Workflow → Agent，不得反向

**禁止**: Agent 直接调用 Provider、Agent 自行决定降级策略
**允许**: Agent 通过 `ctx.capabilities.llm.generate()` 调用，Platform 负责路由和降级

### 规则 8：Workspace 只做 Adapter → Business Logic

**禁止**: Workspace 的 Service 直接 import Platform 内部模块
**允许**: Workspace Service 继承 `WorkspaceAdapter`，通过 `PlatformSDK` 与平台交互

---

## 6. 命名规范

| 场景 | 旧（禁止） | 新（强制） |
|------|-----------|-----------|
| 数据模型 | GeoClaim, GeoEvidence | KnowledgeClaim, KnowledgeEvidence |
| 数据模型 | GeoProject (Brand) | Project (type='geo') |
| Workspace 目录 | `workspace/brand-geo/` | `workspace/geo/` |
| Workspace 目录 | `modules/geo/` | `workspace/geo/` |
| API 路径 | `/api/brand/geo/*` | `/api/geo/*` |
| 组件前缀 | `BrandGEOWorkspace` | `GEOWorkspace` |
| Store 命名 | `useBrandGeoStore` | `useGeoStore` |
| Runtime 文件 | `useBrandGEORuntime` | 删除，使用 Platform Runtime |

---

## 7. 执行与审计

### 7.1 PR 审查清单

每个 PR 在合并前必须通过以下检查：

```
□ 不包含 `import prisma` 在 workspace/ 目录下
□ 不包含 `fetch(` 或 `axios(` 在 workspace/ 目录下
□ 不包含独立 Runtime 实现（runtime/ 目录或 composables/use*Runtime）
□ 不包含自定义 Auth 逻辑
□ API 路径不包含 `brand/` 前缀
□ 不包含 `Geo*` 数据模型命名（仅允许 `Knowledge*`）
□ 不包含独立 Workflow Engine 实现
□ 不包含 scoped Agent Registry
□ 目录结构符合 workspace/<name>/ 规范
□ 使用了 Platform SDK 替代直接调用
```

### 7.2 自动化检查

CI pipeline 必须包含以下自动化规则检查：

```bash
# 检查 workspace 是否 import prisma
! grep -r "import.*prisma" workspace/ --include="*.ts" --include="*.vue"

# 检查 workspace 是否直接 fetch/axios
! grep -rn "fetch(" workspace/ --include="*.ts" --include="*.vue"
! grep -rn "axios." workspace/ --include="*.ts" --include="*.vue"

# 检查 workspace 是否包含独立 Runtime
! find workspace/ -name "*.runtime.ts" | grep "."
! find workspace/ -name "use*Runtime*" | grep "."

# 检查 API 路径是否使用 brand/ 前缀
! grep -rn "'/api/brand" workspace/ --include="*.ts" --include="*.vue"

# 检查数据模型命名
! grep -rn "interface Geo\(Claim\|Evidence\|Citation\|FAQ\|Schema\)" --include="*.ts"
```

### 7.3 违规处理

| 违规级别 | 说明 | 处理 |
|---------|------|------|
| 🔴 Critical | 违反规则 1-4（Runtime/Auth/Prisma/Fetch） | PR 不合并，退回重构 |
| 🟡 Major | 违反规则 5-8（Agent/Workflow/Capability/Direct） | PR 不合并，退回重构 |
| 🟢 Minor | 命名不规范（Geo* 前缀、brand-geo 目录等） | PR 可合并在注明，需在 1 周内修正 |

---

## 8. 从审查结果看本宣言的必要性

GEO 工程审查和架构审计发现以下违规行为——这些正是本宣言要杜绝的：

| 发现项 | 违反规则 | 当前状态 |
|--------|---------|----------|
| Brand GEO 前端 18+ 端点全部 404 | 规则 4（直接 fetch） | 🔴 待修复 |
| KMKI 独立 `geo.runtime.ts` | 规则 1（独立 Runtime） | 🔴 待删除 |
| Brand 独立 `useBrandGEORuntime.ts` (~280 行) | 规则 1（独立 Runtime） | 🔴 待删除 |
| 所有 GEO routes 无 auth 中间件 | 规则 2（无 Auth） | 🔴 待修复 |
| 13 个重复 `mapPrisma*` 函数 | 规则 3（无 BaseRepository） | 🟡 待抽象 |
| 2 套 Project 表（KMKI + Brand） | 规则 3（独立 DB） | 🔴 待合并 |
| 8/8 Agents 全部 stub | 规则 7（能力流断裂） | 🔴 待修复 |
| 1A Agents 注册方式与 1B 不一致 | 规则 5（注册不一致） | 🟡 待统一 |
| Brand 前端手动 `getAuthHeaders()` | 规则 2（自定义 Auth） | 🔴 待删除 |

---

## C0.5: 架构合规（Architecture Compliance）

> **C0.5 将基线文档转化为可自动验证的规则。不再有文档层面的争论——一切由工具执行。**

### 合规工具链

| 工具 | 路径 | 说明 |
|------|------|------|
| **架构 Linter** | `scripts/architecture-linter.sh` | 8 条架构规则 + 4 条 ADR 验证的自动化检查脚本 |
| **CI 集成** | `.github/workflows/architecture-lint.yml` | 每次 PR 自动触发合规检查 |
| **治理规范** | `docs/baselines/GOVERNANCE-SPEC.md` | 第 11 个基线，定义评审/RFC/废弃/发布/违规处理流程 |
| **WorkspaceAdapter** | `packages/studio-platform/src/workspace/workspace-adapter.ts` | 所有 Workspace 的唯一扩展点接口 |

### 本地合规检查

```bash
# 运行完整合规检查
bash scripts/architecture-linter.sh

# 自动修复可修复的问题（如重命名遗留目录）
bash scripts/architecture-linter.sh --fix

# 检查特定 Workspace
bash scripts/architecture-linter.sh --workspace=geo
```

### C0.5 增量规则

C0.5 在 C0 的 8 条规则基础上，新增以下合规约束：

| 规则 | 说明 | 自动化 |
|------|------|--------|
| **R9** | 所有 PR 必须引用受影响的 ADR | 审查清单 C15 |
| **R10** | CI 必须通过架构 Linter 检查 | GitHub Actions |
| **R11** | 废弃必须经过三阶段流程 | 审查清单 + 治理规范 |
| **R12** | Workspace 升级必须锁定 MINOR 版本 | package.json 审查 |

### 验证检查清单

每个 PR 合并前必须通过 `scripts/architecture-linter.sh` 的检查。详见 `GOVERNANCE-SPEC.md §7` 的完整 15 项审查清单。

---

*本宣言是昆仑镜 V4 平台架构的最高效力文件。所有架构决策、技术评审、PR 合入均以本宣言为准。*
*如有违反，产品架构师（熊大）拥有一票否决权。*
