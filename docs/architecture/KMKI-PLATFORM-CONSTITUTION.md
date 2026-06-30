# KMKI Platform Constitution

> **Version**: 1.1  
> **Status**: Ratified  
> **Date**: 2026-07-20  
> **Supersedes**:  
> All prior platform architecture documents — this is the single source of truth for platform-level constraints.
>
> **Document Hierarchy**:  
> ```
> KMKI Platform Constitution（最高级，不可违反）
>   └── KMKI Platform Blueprint
>         ├── Center Specifications
>         └── Workspace Specifications
>               └── Implementation Guides
> ```

---

# Ch 0 — Design Goals

昆仑镜平台为什么设计成这样？以下六个目标驱动所有架构决策。

| Goal | Description |
|------|-------------|
| **Replaceable** | 任何 Provider 都可以替换，而不影响上层 Workspace。AI 模型市场日新月异，平台不能让 Workspace 绑定在任何单一 Provider 上。 |
| **Evolvable** | 新增 Capability 或 Platform Center 不需要大规模重构。平台的演进速度应快于任何单个 Workspace。 |
| **Reusable** | 平台能力由多个 Workspace 共享，而不是在每个 Workspace 中重复实现。杜绝"GEO 有 Citation，短剧也有 Citation，各写一套"的情况。 |
| **Governable** | 架构规则可以自动审计，而不是依赖人工记忆。OpenClaw 或 CI 应能自动检查任何变更是否违反宪法。 |
| **Observable** | 所有关键调用、成本、性能、错误都必须可追踪。没有盲区。 |
| **Scalable** | 支持未来增加新的 Workspace、Provider 和 Agent，而不需要重新设计架构。 |

> **Every rule in this document can be traced back to one or more of these goals.**

---

# Ch 1 — Platform Philosophy

平台不只是一个技术架构——它是一个合同。以下五条原则定义了昆仑镜存在的理由和工作方式。

## 1.1 Platform 不直接服务终端用户，Platform 服务 Workspace

- **Why**: Workspace 是用户感知的边界。Platform 的职责是让 Workspace 更轻、更快、更可靠。
- **Implication**: Platform API 的消费者只能是 Workspace，不能是前端 UI 或外部客户端。所有面向用户的交互必须经过 Workspace 层。

## 1.2 Workspace 不实现平台能力，只消费平台能力

- **Why**: Citation、Trust、Credential 等基础设施一旦在 Workspace 内实现，就无法被其他 Workspace 复用，且会随 Workspace 的演化而漂移。
- **Implication**: Workspace 代码中禁止出现 Provider 调用、Credentials 管理、Runtime 调度等平台职责。

## 1.3 Platform 不知道 Workspace 的业务

- **Why**: Platform 一旦理解业务语义，就会产生针对特定业务的特化逻辑，导致与其他 Workspace 耦合。
- **Implication**: Platform API 的输入和输出必须是通用结构。Workspace 在 Adapter 层完成语义翻译。

## 1.4 Workspace 不知道 Provider 的存在

- **Why**: Provider 替换不应影响 Workspace 代码。Workspace 只关心 Capability，不关心实现者。
- **Implication**: Workspace 代码中禁止出现模型名称、Provider 名称、API Key 引用。

## 1.5 Capability 是唯一的业务语言

- **Why**: 统一的能力命名体系让 Workspace、Platform、Runtime 使用同一套词汇表交流，消除语义鸿沟。
- **Implication**: 任何 AI 调用必须通过 Capability Registry 路由。代码中不应出现 `callDeepSeek()`、`useQwen()` 这样的函数。

## 1.6 Platform Exists to Reduce Workspace Complexity

> **平台存在的唯一意义，是持续降低 Workspace 的复杂度。**

- **Why**: 这是所有架构决策的最高裁决标准。如果一项新增不能使 Workspace 变简单，就不应该进入 Platform。
- **Implication**: 任何新 Center、新 Capability、新 API 的评审，第一问题必须是：Workspace 会因此变简单吗？

### 1.7 Workspace 永远允许删除后重建

- **Principle**: Workspace 永远允许删除后重新创建。Platform 永远不能依赖任何 Workspace 的存在。
- **Why**: 如果 Platform 依赖 Workspace 的存在，删除一个 Workspace 将导致 Platform 功能异常，这是架构耦合的信号。
- **Implication**: Platform 中的数据必须是 Workspace 无关的。Workspace 数据存在时，Platform 提供服务；Workspace 删除后，Platform 不应受影响。

---

# Ch 2 — Architecture Constitution

以下规则不可违反。共 29 条规则。每条规则都有明确的合规检查方法，可由 OpenClaw 或 CI Pipeline 自动执行。

---

## Core Principles

### KMKI-CONST-001: 分层不可逆转

- **Rule**: Workspace → Adapter → Platform API → Platform Service → Runtime → Provider 的调用链方向不可逆转。下层不允许调用上层。
- **Rationale**: 防止循环依赖和架构退化。这一条是昆仑镜的"三权分立"。
- **Compliance Check**: `import` 扫描不允许出现 Platform → Workspace 的引用。
- **Violation Example**: Platform 的 AI Center 直接 import GEO 的某个组件。
- **Correct Pattern**: Platform 通过事件或回调接口与 Workspace 通信，不做直接 import。

### KMKI-CONST-002: 不允许平台核心模块依赖第三方 SDK

- **Rule**: Platform 核心模块（AI Center、Runtime Center、Capability Center）不允许直接依赖任何 Provider 的 SDK。Provider SDK 只能出现在 Provider Adapter 层。
- **Rationale**: 避免 Provider SDK 的版本冲突和 API 变更污染核心逻辑。
- **Compliance Check**: 扫描核心模块的 `package.json` 和 import，不得包含 `openai`、`@deepseek`、`@anthropic` 等 Provider SDK。
- **Violation Example**: AI Center 的 `model-router.ts` 直接 import `openai`。
- **Correct Pattern**: AI Center 定义通用 Provider Interface，由独立的 Provider Adapter 包实现 SDK 调用。

### KMKI-CONST-020: 架构分层归属

- **Rule**: 每个模块必须明确归属于且仅归属于一个 Architecture Layer。不允许存在"跨越两层"的模块。Layer 定义如下：

  ```
  Presentation Layer   — 前端 UI、页面、组件
  Application Layer    — Workspace 逻辑、Store、Adapter
  Capability Layer     — Capability Registry、Capability 路由
  Runtime Layer        — 执行调度、重试、流式、缓存
  Provider Layer       — Provider Adapter、SDK 封装
  Infrastructure Layer — 数据库、消息队列、对象存储
  ```

- **Rationale**: 没有明确的层归属，模块职责会随时间漂移。跨层模块是架构退化的前兆。
- **Compliance Check**: 扫描每个模块的目录路径和 package 配置，确认有 `layer` 声明。不允许 `Presentation Layer` 的模块直接引用 `Runtime Layer`。
- **Violation Example**: Workspace 的 Vue 页面中直接调用 Runtime 层的执行调度函数。
- **Correct Pattern**: Vue 页面调用 Adapter（Application Layer），Adapter 调用 Platform API（Capability Layer），API 再调度 Runtime。

### KMKI-CONST-021: 状态唯一所有权

- **Rule**: 每个状态（State）必须有且仅有一个 Owner。非 Owner 不允许直接修改该状态。读取必须通过 Owner 暴露的 API。
- **Rationale**: 状态的多处修改是分布式系统中最难排查的问题。状态所有者不明确意味着状态同步的责任人也不明确。
- **Compliance Check**: 扫描状态修改点，确认只有一个模块负责写入。不允许出现两个 Center 同时修改同一张表或同一个 Redis Key。
- **Violation Example**: Workspace 将 Provider Health 缓存在本地 Redis 中并自行更新，而不是从 AI Center 读取。
- **Correct Pattern**: Provider Health 由 AI Center 管理并写入，Workspace 通过 API 读取（不缓存或短缓存）。

状态所有权映射（初始）：
  | State | Owner | Access |
  |-------|-------|--------|
  | Provider Health | AI Center | Read via API |
  | Credential | Credential Vault (AI Center) | Never exposed |
  | Execution Trace | Runtime Center | Read via API |
  | User Identity | Identity Center | Read via Token |
  | Usage / Cost | AI Center + Billing Center | Batch sync |
  | Knowledge Object | Knowledge Center | Read via API |
  | Asset Metadata | Asset Center | Read via API |

---

## Dependency Rules

### KMKI-CONST-003: Platform 禁止 import Workspace

- **Rule**: 任何 Platform 模块都不能 import 任何 Workspace 的代码、类型或配置。
- **Rationale**: Platform 不知道 Workspace 的存在。违反此规则将导致 Platform 与特定 Workspace 耦合。
- **Compliance Check**: 扫描 `platform/`、`core/`、`runtime/` 目录中所有 import 路径，不允许包含 `/workspace/` 或特定 Workspace 名称。
- **Violation Example**: Trust Center 引用 `brand-geo/adapters/geoTrustAdapter.ts`。
- **Correct Pattern**: Trust Center 定义通用 Trust API，Workspace 通过 Adapter 调用。

### KMKI-CONST-004: Workspace 只能依赖 Platform API

- **Rule**: Workspace 的依赖图中，所有与平台能力的交互都必须通过 Platform API 层。不允许跳过 API 直接访问 Service、Runtime 或 Provider。
- **Rationale**: API 层是契约边界。跳过 API 等同于破坏合同。
- **Compliance Check**: 扫描 Workspace 中的 import，不允许出现 `core/`、`runtime/`、`provider/` 等路径。
- **Violation Example**: GEO 的 adapter 直接调用 `runtime/execution-scheduler.ts`。
- **Correct Pattern**: GEO adapter 调用 `POST /api/ai/generate`，由 API 层调度 Runtime。

### KMKI-CONST-022: Center 间通信优先使用事件

- **Rule**: Platform Center 之间的通信应优先使用异步事件，而非同步 HTTP 调用。需要实时响应的场景可以使用同步 API，但必须通过事件总线解耦。
- **Rationale**: Center 间如果全部使用 HTTP 直调，依赖关系会随 Center 数量增长演变为蜘蛛网，难以维护和扩展。事件总线确保新增 Center 不会引入循环依赖。
- **Compliance Check**: 扫描 Center 间的调用模式，确认跨 Center 通信有 Event Schema 定义。不允许两个 Center 之间产生双向 HTTP 依赖。
- **Violation Example**: AI Center 在处理模型注册时直接调用 Observability Center 的 HTTP API 来记录日志。
- **Correct Pattern**: AI Center 发布 `model.registered` 事件，Observability Center 订阅该事件进行处理。

初始事件定义：
  | Event | Publisher | Subscribers |
  |-------|-----------|-------------|
  | `provider.status_changed` | AI Center | Runtime, Observability |
  | `capability.registered` | Capability Center | AI Center, Developer Center |
  | `cost.threshold_reached` | Billing Center | AI Center, Developer Center |
  | `asset.uploaded` | Asset Center | Knowledge Center |
  | `knowledge.updated` | Knowledge Center | Trust Center, Search |

---

## Capability Rules

### KMKI-CONST-005: Capability 是唯一的 AI 调用入口

- **Rule**: 任何 AI 能力的调用都必须通过 Capability Registry 路由。代码中不允许直接调用 Provider 的 API。
- **Rationale**: Capability 层提供 Provider 透明化、Fallback、负载均衡和成本控制。没有这一层，Provider 替换将导致所有 Workspace 修改。
- **Compliance Check**: 扫描代码中所有 AI 调用点，确认经过 Capability Registry。不允许出现 `fetch('https://api.openai.com')` 或 `new DeepSeekClient()`。
- **Violation Example**: 短剧工作台的 `storyboard-generator.ts` 直接调用 DeepSeek API。
- **Correct Pattern**: 调用 `capability.invoke('text.generate', { prompt })`。

### KMKI-CONST-006: Capability Contract 不允许破坏

- **Rule**: 已发布的 Capability 的输入/输出接口（Schema）不允许向后不兼容的变更。新增参数必须是 optional。
- **Rationale**: Workspace 依赖 Capability Contract。破坏 Contract 意味着所有 Workspace 需要同步修改。
- **Compliance Check**: Capability 注册时必须附带 Schema 版本。CI 检查版本变更是否向后兼容。
- **Violation Example**: 将 `text.generate` 的 `prompt` 参数从 string 改为 object。
- **Correct Pattern**: 新增 `text.generate-v2`，旧版本标记 deprecated。

---

## Runtime Rules

### KMKI-CONST-007: Runtime 不允许出现业务逻辑

- **Rule**: Runtime Center 中不允许出现任何与特定业务领域相关的逻辑。Runtime 只负责人：调度、重试、超时、并发、流式传输、缓存。
- **Rationale**: Runtime 包含业务逻辑后，将无法被多个 Workspace 共享，且会在每次业务需求变更时被修改。
- **Compliance Check**: 扫描 Runtime 模块中的条件分支、switch-case、if-else，确认没有业务领域关键词（如"品牌"、"声明"、"故事板"）。
- **Violation Example**: Runtime 中包含 `if (type === 'brand' || type === 'drama')` 的分支。
- **Correct Pattern**: 业务逻辑在 Capability 层或 Workspace Adapter 层处理。

### KMKI-CONST-008: 所有 AI 调用必须可追踪

- **Rule**: 每个 AI 调用必须产生结构化的 Trace Event，包含：请求 ID、Capability、Provider、Model、输入大小、输出大小、延迟、成本、状态。
- **Rationale**: 没有可观测性，就无法治理成本、诊断问题、优化性能。
- **Compliance Check**: Capability Registry 的 invoke 方法必须返回 Trace ID。不允许"静默调用"。
- **Violation Example**: 代码中直接 `await model.generate(prompt)` 而不记录 Trace。
- **Correct Pattern**: `const traceId = await capability.invoke('text.generate', { prompt })`。

---

## API Rules

### KMKI-CONST-009: 统一 Response Schema

- **Rule**: 所有 Platform API 的响应必须遵循统一的 Schema：`{ success: boolean, data: T | null, message: string, pagination?: { page, pageSize, total } }`。
- **Rationale**: 不一致的返回结构增加 Workspace 的错误处理复杂度，也使得 API Gateway 无法统一处理。
- **Compliance Check**: API Route 的返回值必须经过 Response Schema 验证。不允许直接 return 裸对象。
- **Violation Example**: 某个 API 返回 `{ items: [...] }` 而另一个返回 `{ results: { data: [...] } }`。
- **Correct Pattern**: 统一使用 `formatSuccess(data)` 和 `formatError(error)` 包装。

### KMKI-CONST-010: 所有 API 必须认证

- **Rule**: 任何暴露给 Workspace 或 Adapter 的 API 端点都必须通过身份认证。不允许存在未认证的端点。
- **Rationale**: 未认证的端点是安全漏洞，也是架构审计的死角。
- **Compliance Check**: 扫描所有路由注册代码，确认每个端点有 `preHandler: [authenticate]`。
- **Violation Example**: 新增的 GEO Report API 忘记添加 authenticate 中间件。
- **Correct Pattern**: 在路由注册阶段统一注入 authenticate 中间件，而非在每个路由中手动添加。

---

## Workspace Rules

### KMKI-CONST-011: 每个 Workspace 必须实现 Adapter 层

- **Rule**: 任何 Workspace 在调用 Platform API 之前，必须经过 Adapter。Adapter 是 Workspace 的一部分，负责业务语义 ↔ 平台 API 的翻译。
- **Rationale**: Adapter 隔离 Workspace 与 Platform 的变更。Platform API 的演进不会直接破坏 Workspace 的业务代码。
- **Compliance Check**: Workspace 目录结构必须包含 `adapters/` 目录，且 Workspace 中的 Platform 调用必须通过 Adapter。
- **Violation Example**: Workspace 的页面直接 `fetch('/api/ai/generate')` 而不通过 Adapter。
- **Correct Pattern**: Workspace 页面调用 `aiAdapter.generate(prompt)`，Adapter 内部调用 Platform API。

### KMKI-CONST-012: Workspace 代码库中禁止出现 Provider 名称

- **Rule**: Workspace 的代码、配置、环境变量中禁止出现 Provider 名称（如 deepseek、openai、qwen、claude 等）。
- **Rationale**: Provider 替换不应需要修改 Workspace 代码。Provider 名称出现在 Workspace 中意味着 Workspace 知道 Provider 的存在。
- **Compliance Check**: 扫描 Workspace 目录中的 `.ts`、`.vue`、`.env`、`.json` 文件，检查是否包含 Provider 名称字符串。
- **Violation Example**: GEO 的配置文件中包含 `"model": "deepseek-chat"`。
- **Correct Pattern**: 配置中使用 `"capability": "text.generate"`，由 Platform 路由到具体 Provider。

---

## Adapter Rules

### KMKI-CONST-013: Adapter 永远属于 Workspace

- **Rule**: Adapter 代码必须存放在 Workspace 目录下，不允许存放在 Platform 目录下。Platform 不应该知道任何 Adapter 的存在。
- **Rationale**: Adapter 的职责是将 Workspace 的业务语义翻译成 Platform API。Platform 不关心这种翻译。
- **Compliance Check**: Platform 模块的 import 不允许引用任何 Adapter。
- **Violation Example**: Platform 的某个 Center 内置了对 `brand-geo/adapter` 的引用。
- **Correct Pattern**: Adapter 在 `workspace/brand-geo/adapters/` 目录下。

### KMKI-CONST-014: Adapter 不允许包含业务逻辑

- **Rule**: Adapter 只做数据格式转换和 API 调用。任何业务判断、条件路由、数据变换逻辑不应出现在 Adapter 中。
- **Rationale**: 业务逻辑出现在 Adapter 中意味着无法被其他 Workspace 共享，也会在业务变更时被修改。
- **Compliance Check**: Adapter 中的条件分支不应引用业务领域概念。
- **Violation Example**: Adapter 中 `if (claim.status === 'approved') { ... }`。
- **Correct Pattern**: 业务逻辑在 Workspace 的 Service/Store 层处理，Adapter 只负责调用 Platform API 并转换数据格式。

---

## Security Rules

### KMKI-CONST-015: Credential 不允许离开 Credential Vault

- **Rule**: API Key、Token、密码等凭证只能在 AI Center 的 Credential Vault 中存储和管理。Workspace 和 Adapter 不允许接触原始凭证。
- **Rationale**: 凭证散布在 Workspace 中意味着安全审计无法覆盖全部，且 Provider 替换需要更新多个位置。
- **Compliance Check**: 扫描 Workspace 和 Adapter 代码，不允许出现 `apiKey`、`token`、`secret` 等凭据相关变量的直接赋值。
- **Violation Example**: GEO 的某个配置文件中包含 `process.env.DEEPSEEK_API_KEY`。
- **Correct Pattern**: AI Center 统一管理凭证，Workspace 通过 `POST /api/ai/generate` 调用，凭证在服务端注入。

---

## Data Rules

### KMKI-CONST-016: 跨 Workspace 数据共享必须通过 Platform

- **Rule**: 如果两个 Workspace 需要共享数据（如 Knowledge Object、Asset、Citation），必须通过 Platform 层的共享数据服务，不允许直接访问对方数据库。
- **Rationale**: 直接访问数据库会导致 Workspace 之间的耦合，破坏架构边界。
- **Compliance Check**: 数据库连接配置中，不允许 Workspace A 的微服务连接 Workspace B 的数据库。
- **Violation Example**: GEO 的服务直接查询短剧工作台的 `executionResults` 表。
- **Correct Pattern**: GEO 调用 `Knowledge Center API` 获取需要的数据。

---

## Observability Rules

### KMKI-CONST-017: 每个 Center 必须暴露健康检查端点

- **Rule**: 所有 Platform Center 必须实现 `/health` 端点，返回`{ status: 'healthy' | 'degraded' | 'down', checks: { ... } }`。
- **Rationale**: 没有健康检查就无法实现自动恢复和运维告警。
- **Compliance Check**: CI 部署前检查每个 Center 是否注册了 Health Check。
- **Violation Example**: AI Center 部署后没有 `/health` 端点。
- **Correct Pattern**: 使用统一 Health Check 注册函数。

---

## Evolution Rules

### KMKI-CONST-018: Capability Contract 变更必须经过 Architecture Review

- **Rule**: 任何影响已发布 Capability 的输入/输出 Schema 的变更，必须经过 Architecture Review Board 批准。
- **Rationale**: Capability Contract 是 Workspace 与 Platform 之间的协议。单方面变更等于撕毁协议。
- **Compliance Check**: CI Pipeline 中检查 Capability Registry 的版本变更并触发 Review Workflow。
- **Violation Example**: 直接修改 `text.generate` 的 response 结构而不经过 Review。
- **Correct Pattern**: 创建 `text.generate-v2`，旧版本保持兼容。

### KMKI-CONST-019: 架构规则可被 OpenClaw 自动审计

- **Rule**: 每条 Constitution Rule 必须伴随一个可执行的 Compliance Check，可以被 OpenClaw 或 CI Pipeline 自动运行。
- **Rationale**: 依赖人工记忆的架构规则会在压力下被违反。自动化审计才能确保长期执行。
- **Compliance Check**: 每条 Rules 的 `Compliance Check` 字段必须描述可脚本化的检查方法。
- **Violation Example**: 某条 Rule 的 Compliance Check 写的是"请人工检查"。
- **Correct Pattern**: 每条 Rule 的检查方法都能转化为 `bash script`、`linter rule` 或 `import scanner`。

### KMKI-CONST-023: 公共契约必须声明生命周期阶段

- **Rule**: 每个 Public Contract（Capability、Platform API、Center API、Adapter Interface）必须声明其生命周期阶段。不允许 Lifecycle Stage 未定义的契约被外部消费。

  Lifecycle 定义：
  | Stage | 含义 | 可消费 | 可修改 |
  |-------|------|--------|--------|
  | `experimental` | 内测中，可能随时变更 | 仅 Dev/Sandbox | 任意 |
  | `preview` | 即将正式发布，API 接近稳定 | 有限白名单 | 需 Review |
  | `stable` | 正式版本，向后兼容 | 所有消费方 | 仅 minor/patch |
  | `deprecated` | 已标记废弃，建议迁移 | 现有消费方仍可用 | 仅 bug fix |
  | `removed` | 已移除 | 不可消费 | N/A |

- **Rationale**: 没有生命周期管理，Platform 将永远无法清理过期契约。Deprecated 的 API 因为"有人用"而永远删不掉，最终导致架构腐化。
- **Compliance Check**: CI Pipeline 检查所有注册的 Capability 和 API 是否有 `lifecycle` 声明。`deprecated` 状态超过指定窗口期的契约自动触发告警。
- **Violation Example**: AI Center 的 `text.generate-v1` 已经废弃 12 个月，但仍处于 `stable` 状态，导致无法删除过时实现。
- **Correct Pattern**: Capability 注册时附带生命周期阶段，`deprecated` 窗口期过后自动进入 `removed`。

### KMKI-CONST-028: 每个 Center 必须可替换

- **Rule**: 任何 Center 都可以在未来被删除或替换，而不影响其他 Center 的核心功能。
- **Rationale**: Center 之间不能形成无法拆开的强绑定。例如删除 Trust Center 不应导致 Knowledge Center 无法工作。
- **Compliance Check**: 依赖矩阵中，不允许任何 Center 的依赖链导致"删除 A 则 B 必须重写"。
- **Violation Example**: Trust Center 的 API 嵌入在 Knowledge Center 的核心查询路径中，删除 Trust Center 导致 Knowledge Center 返回错误。
- **Correct Pattern**: Trust Center 通过可选中间件或 Plugin 模式集成，Knowledge Center 在 Trust Center 不可用时降级（返回原始分数而非信任分数）。

### KMKI-CONST-029: 架构评审需输出量化评分

- **Rule**: 每次 Architecture Review 必须输出量化评分（满分 100），而非简单的 PASS/FAIL。
- **Rationale**: PASS/FAIL 缺少粒度。80 分和 50 分的 PASS 在实际意义上完全不同。
- **Compliance Check**: Review 输出必须包含评分表和单项得分。
- **Correct Pattern**:
  ```
  Boundary: 20/20
  Dependency: 18/20
  Data Ownership: 20/20
  Observability: 17/20
  Security: 19/20
  TOTAL: 94/100
  ```

---

# Ch X — Data Constitution

### Purpose
Constitution 定义了谁调用谁、谁负责什么。Data Constitution 定义数据属于谁。

### KMKI-CONST-024: 每个数据对象有且仅有一个 Owner Center

- **Rule**: Every Data Object (Database Table, Document, Cache Entry, Configuration) has exactly one Owner Center. Non-Owner Centers cannot write to the object directly.
- **Rationale**: 数据没有 Owner 意味着数据同步责任人不明确。多个 Center 同时写入同一数据源是平台最常见的架构腐败来源。
- **Compliance Check**: 扫描所有数据库表、集合、Redis Key，确认每个数据对象有且仅有一个 Owner Center 声明。不允许两个 Center 同时写入同一张表。

### KMKI-CONST-025: 单一真相源 (Single Source of Truth)

- **Rule**: 任何状态、配置、Capability 定义只能有一个 Truth Source。不允许同一数据在多个位置以不一致的方式存储。
- **Rationale**: 数据库一份、Redis 一份、Workspace 本地一份、LocalStorage 一份——四份数据四个值，无法判断哪一份是正确的。
- **Compliance Check**: 扫描数据读取路径，确认所有消费方从同一 Truth Source 读取。不允许重复存储同一逻辑数据。
- **Violation Example**: AI Center 将 Provider 健康状态缓存在本地文件，同时 Observability Center 也在内存中维护一份。
- **Correct Pattern**: 定义 AI Center 为 Truth Source，Observability 通过 API 或 Event 读取。

### KMKI-CONST-026: 数据归属映射

初始数据对象归属：

| Data Object | Owner Center | Read Scope | Write Scope |
|-------------|-------------|-----------|-------------|
| Provider Health | AI Center | All Centers via API | AI Center only |
| Credential | AI Center (Credential Vault) | Never (injected at runtime) | AI Center only |
| Capability Definition | Capability Center | All Centers via Registry API | Capability Center only |
| Execution Trace | Runtime Center | Observability, Billing via API | Runtime Center only |
| Knowledge Object | Knowledge Center | All Workspace via API | Knowledge Center only |
| Asset | Asset Center | All Workspace via API | Asset Center only |
| Trust Score | Trust Center | All Workspace via API | Trust Center only |
| User Identity | Identity Center | All Centers via Token | Identity Center only |
| Usage / Cost | AI Center (raw) → Billing Center (aggregated) | Workspace via Billing API | AI Center (raw writes) |
| Configuration | Owner Center per config | Depends | Owner Center only |

### KMKI-CONST-027: 读取不创建依赖

- **Rule**: 读取另一个 Center 的数据不构成依赖关系。只有写入或需要同步回调才构成依赖。
- **Rationale**: 防止数据读取被误判为架构耦合。Workspace 读取 Knowledge Object 不是依赖 Knowledge Center，而是消费其服务。
- **Compliance Check**: 依赖矩阵中只记录写入依赖和回调依赖，不记录只读依赖。

---

# Ch 3 — Capability Language

Capability Language 是昆仑镜平台的通用词汇表。所有 Workspace 只说 Capability，不说 Provider。

## 3.1 分类体系

| Category | Prefix | Examples |
|----------|--------|----------|
| Text Generation | `text.` | `text.generate`, `text.chat`, `text.complete` |
| Reasoning | `reason.` | `reason.generate`, `reason.analyze`, `reason.extract` |
| Embedding | `embedding.` | `embedding.encode`, `embedding.similarity` |
| Vision | `vision.` | `vision.analyze`, `vision.ocr`, `vision.detect` |
| Audio | `audio.` | `audio.transcribe`, `audio.tts`, `audio.diarize` |
| Video | `video.` | `video.generate`, `video.analyze`, `video.edit` |
| Search | `search.` | `search.semantic`, `search.hybrid`, `search.fulltext` |
| Knowledge | `knowledge.` | `knowledge.retrieve`, `knowledge.extract`, `knowledge.classify` |
| Analysis | `analysis.` | `analysis.sentiment`, `analysis.summarize`, `analysis.classify` |
| Image | `image.` | `image.generate`, `image.edit`, `image.analyze` |
| Translation | `translate.` | `translate.text`, `translate.detect` |
| Code | `code.` | `code.generate`, `code.review`, `code.translate` |

## 3.2 命名约定

- 使用小写英文字母和点号分隔
- 格式：`{category}.{verb}` 或 `{category}.{verb}.{modifier}`
- 禁止使用 Provider 名称作为 Capability 名称的一部分
- 禁止使用 Workspace 名称作为 Capability 名称的一部分

## 3.3 初始 Capability 列表

| Capability | Input (Key Fields) | Output (Key Fields) |
|------------|-------------------|---------------------|
| `text.generate` | `prompt`, `systemPrompt`, `temperature`, `maxTokens` | `text`, `finishReason`, `usage` |
| `text.chat` | `messages[]`, `temperature` | `message`, `usage` |
| `reason.generate` | `prompt`, `reasoningEffort` | `reasoning`, `answer`, `confidence` |
| `embedding.encode` | `texts[]`, `model` | `embeddings[]`, `dimension` |
| `vision.analyze` | `image`, `question` | `description`, `objects[]`, `labels[]` |
| `vision.ocr` | `image` | `text`, `confidence`, `blocks[]` |
| `audio.transcribe` | `audio`, `language` | `text`, `segments[]`, `duration` |
| `audio.tts` | `text`, `voice`, `speed` | `audio`, `duration` |
| `video.generate` | `prompt`, `style`, `duration` | `video`, `frames`, `cost` |
| `image.generate` | `prompt`, `style`, `size` | `image`, `revisedPrompt` |
| `search.semantic` | `query`, `index`, `topK` | `results[]`, `total` |
| `knowledge.retrieve` | `query`, `projectId`, `filters` | `objects[]`, `relevance[]` |

## 3.4 Capability 版本化

- 每个 Capability 定义必须包含版本号（semver）
- 向后兼容的变更：minor 版本递增
- 向后不兼容的变更：创建新 Capability（如 `text.generate-v2`）
- 旧版本标记为 `deprecated`，至少保持一个 deprecated 窗口期

## 3.5 Capability Registry（能力注册表）

从 Capability Language 到 Capability Registry 的升级是 Platform 成熟的标志。每个 Capability 在 Registry 中应包含完整元数据：

```typescript
interface CapabilityDefinition {
  id: string                          // "reason.generate"
  version: string                     // "2.1.0"
  owner: string                       // "Capability Center"
  lifecycle: 'experimental' | 'preview' | 'stable' | 'deprecated' | 'removed'
  tier: 'free' | 'standard' | 'premium'
  cost: { perToken: number; perRequest: number }
  timeout: number                     // max ms
  retry: { maxAttempts: number; backoff: 'linear' | 'exponential' }
  cache: { ttl: number; strategy: 'none' | 'simple' | 'semantic' }
  permission: string[]                // 所需权限
  observability: { trace: boolean; logBody: boolean }
  sla: { p99: number; availability: number }
  fallback: string[]                  // 降级 Capability 列表
  providerPolicy: 'cost-first' | 'latency-first' | 'manual-pin'
  schema: {
    input: JSONSchema
    output: JSONSchema
  }
}
```

示例：`reason.generate` 的 Registry 条目：
```yaml
id: reason.generate
version: 2.1.0
owner: Capability Center
lifecycle: stable
tier: premium
timeout: 120000
retry:
  maxAttempts: 2
  backoff: exponential
fallback:
  - reason.generate-lite
  - text.generate
providerPolicy: cost-first
```

Capability Registry 由 Capability Center 统一维护，AI Center、Runtime Center、Billing Center 均消费该 Registry。

---

# Ch 4 — Platform Centers

## Center 总览

```
┌─────────────────────────────────────────────────────┐
│                    Developer Center                   │
├─────────────────────────────────────────────────────┤
│                 Observability Center                  │
├────────┬────────┬────────┬────────┬────────┬────────┤
│   AI   │Runtime │Capability│ Trust │ Asset │Knowledge│
│ Center │ Center │  Center  │ Center│ Center│ Center  │
├────────┴────────┴─────────┴───────┴────────┴────────┤
│                  Identity Center                      │
├──────────────────────────────────────────────────────┤
│                  Billing Center                       │
└──────────────────────────────────────────────────────┘
```

---

### AI Center

| | |
|---|---|
| **负责** | Provider Registry、Credential Vault、Model Registry、Runtime Profile（模型→Provider映射）、Quota Management、Cost Tracking、Health Check、API Key生命周期 |
| **绝不负责** | 模型调用调度（那是 Runtime）、业务路由（那是 Capability）、任务执行（那是 Runtime）、Provider SDK 实现（那是 Provider Adapter） |
| **依赖** | Identity Center（认证）、Observability Center（日志/追踪） |

### Runtime Center

| | |
|---|---|
| **负责** | 请求分发、重试策略、Fallback 链、负载均衡、流式传输代理、超时管理、并发控制、缓存层、执行追踪 |
| **绝不负责** | 模型管理（那是 AI Center）、能力路由（那是 Capability Center）、业务逻辑（永远不） |
| **依赖** | AI Center（Provider 配置）、Capability Center（路由策略）、Observability Center |

### Capability Center

| | |
|---|---|
| **负责** | Capability Registry、Capability → Provider 路由策略、请求增强（Prompt 注入）、响应标准化、Fallback 编排 |
| **绝不负责** | 模型管理（那是 AI Center）、请求执行（那是 Runtime）、业务逻辑 |
| **依赖** | AI Center（Provider 列表）、Runtime Center（执行能力） |

### Trust Center

| | |
|---|---|
| **负责** | Evidence Score、Claim Verification、Source Quality、Freshness、Consistency、Citation Confidence、Trust Score 计算 |
| **绝不负责** | 具体业务领域的信任模型（那是 Workspace 层）、知识抽取 |
| **依赖** | AI Center（LLM 调用）、Knowledge Center（事实来源） |

### Asset Center

| | |
|---|---|
| **负责** | 统一资产存储、版本管理、资产搜索、图标/Logo/字体/音乐/模板/图片/视频/Prompt/品牌资产 |
| **绝不负责** | 资产的生产（那是 Workspace 层）、资产的知识关联 |
| **依赖** | Identity Center（访问控制） |

### Knowledge Center

| | |
|---|---|
| **负责** | Knowledge Object 管理、知识图谱、语义检索、实体关联、知识版本、知识质量评分 |
| **绝不负责** | 具体业务的知识模型（那是 Workspace 层）、信任评分 |
| **依赖** | AI Center（LLM/Embedding）、Asset Center（知识资产的存储） |

### Identity Center

| | |
|---|---|
| **负责** | 用户认证、API Token 管理、角色权限、SSO、组织/团队管理 |
| **绝不负责** | 资源配额（那是 Billing）、模型访问控制（那是 AI Center） |
| **依赖** | 无（基础设施层） |

### Billing Center

| | |
|---|---|
| **负责** | 用量计费、配额管理、订阅管理、发票、成本分析 |
| **绝不负责** | 认证（那是 Identity）、健康检查（那是 Observability） |
| **依赖** | Identity Center、AI Center（用量数据） |

### Observability Center

| | |
|---|---|
| **负责** | 集中日志、指标收集、Tracing、告警规则、Dashboard、健康检查聚合 |
| **绝不负责** | 业务监控（那是 Workspace 层）、成本控制（那是 Billing） |
| **依赖** | 所有 Center（数据源） |

### Developer Center

| | |
|---|---|
| **负责** | API 文档、SDK 发布、沙箱环境、开发者 Portal、CLI 工具、API Key 自助生成 |
| **绝不负责** | 生产环境管理、认证 |
| **依赖** | 所有 Center（文档聚合） |

### 4.1 Center Dependency Matrix

| Center ↓ \ → Depends On | AI | Runtime | Capability | Trust | Asset | Knowledge | Identity | Billing | Observability |
|-------------------------|----|---------|------------|-------|-------|-----------|----------|---------|---------------|
| **AI Center** | - | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ | ✔ |
| **Runtime Center** | ✔ | - | ✔ | ✖ | ✖ | ✖ | ✔ | ✖ | ✔ |
| **Capability Center** | ✔ | ✔ | - | ✖ | ✖ | ✖ | ✔ | ✖ | ✔ |
| **Trust Center** | ✔ | ✖ | ✖ | - | ✖ | ✔ | ✔ | ✖ | ✔ |
| **Asset Center** | ✖ | ✖ | ✖ | ✖ | - | ✖ | ✔ | ✖ | ✔ |
| **Knowledge Center** | ✔ | ✖ | ✖ | ✖ | ✔ | - | ✔ | ✖ | ✔ |
| **Identity Center** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | - | ✖ | ✔ |
| **Billing Center** | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ | - | ✔ |
| **Observability Center** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | - |

规则：
- 任何 PR 新增的 Center 间调用必须先查矩阵。
- 矩阵中不允许的依赖→直接 Fail。
- Center 间不允许双向依赖（双向 ✔ 即为违规）。

---

# Ch 5 — Workspace Contract

## 5.1 架构模型

```
Workspace
  ↓ 调用
Workspace Adapter（数据格式转换）
  ↓ HTTP/RPC
Platform API（统一接口层）
  ↓
Platform Service（业务编排）
  ↓
Runtime（调度与执行）
  ↓
Provider Adapter → Provider SDK → Provider API
```

### 5.1.1 Platform API 内部架构

Platform API 不是单一层。它必须拆分为：

```
Gateway
  认证 (Authentication)
  限流 (Rate Limiting)
  Trace ID 注入
  请求路由

↓

Controller
  参数解析与校验
  权限检查 (Authorization)
  响应格式化

↓

Service
  业务编排
  跨 Center 协调
  错误处理与降级

↓

Repository
  数据访问
  缓存策略
```

禁止：
- Route 或 Controller 中直接写 SQL 或调用 Provider API
- Service 层跳过 Repository 直接操作数据库
- Gateway 层包含业务逻辑

## 5.2 Adapter 生命周期

| 阶段 | 职责 |
|------|------|
| Register | Adapter 初始化，校验 Platform API 连通性，注册健康检查 |
| Call | 接收 Workspace 数据，转换为 Platform API Schema，发起调用 |
| Handle Error | 捕获 Platform API 错误，转换为 Workspace 可理解的错误 |
| Retry | 根据 Platform API 返回的重试策略决定是否重试 |
| Degrade | 当 Platform API 不可用时，返回 Fallback 数据或降级提示 |

## 5.3 API 约定

- **协议**: HTTP/2 + JSON
- **认证**: Bearer Token（由 Identity Center 颁发）
- **数据流**: 请求/响应 模型。流式能力通过 Server-Sent Events 支持。
- **请求结构**: `{ params: Record<string, any>, context: { traceId, userId, workspaceId }, options?: { timeout, priority } }`
- **响应结构**: `{ success: boolean, data: T | null, message: string, traceId: string, pagination?: { page, pageSize, total } }`

## 5.4 错误处理

| Error Type | HTTP Code | message 示例 | 处理方式 |
|-----------|-----------|--------------|----------|
| Validation | 400 | "参数 projectId 不能为空" | Adapter 重试前修正 |
| Authentication | 401 | "token 已过期" | Adapter 刷新 Token |
| Authorization | 403 | "无权限访问该资源" | 不重试，上报 |
| Not Found | 404 | "资源不存在" | 不重试，降级 |
| Rate Limit | 429 | "请求过多" | Adapter 退避重试 |
| Server Error | 500 | "服务临时不可用" | Adapter 可重试 |
| Timeout | 504 | "上游服务超时" | Adapter 可重试 |

## 5.5 Adapter 归属

Adapter 代码必须存放在 Workspace 目录下，绝不允许存放在 Platform 目录。

`workspace/{workspace-name}/adapters/{adapter-name}.ts`

---

# Ch 6 — Migration Roadmap

## 第一批：GEO + 短剧工作台

目标：将 AI 调用统一迁移至 Capability Center + AI Center。

| 迁移项 | 当前状态 | 目标状态 | 优先级 |
|--------|---------|---------|--------|
| GEO Embedding/LLM 调用 | 直接调用 Provider | Capability.invoke | P0 |
| GEO Credential 管理 | Workspace 管理 | AI Center Credential Vault | P0 |
| 短剧 LLM 调用 | 直接调用 Provider | Capability.invoke | P1 |
| GEO Evidence/Claim | GEO 内部实现 | Trust Center 消费（Phase 2） | P2 |

## 第二批：小说 + PPT 工作台

- 迁移 AI 调用至 Capability Center
- 接入统一 Asset Center（PPT 模板、小说封面）
- 统一 Knowledge Object 模型

## 第三批：后续新工作台

- 新 Workspace 默认使用 Capability Language
- 通过 Workspace Contract 快速创建
- 自动接入 Observability Center

---

# Ch 7 — Architecture Review Checklist

任何新增模块、Capability、Center 或 Workspace 在架构评审时必须回答以下问题：

| # | 问题 | 对应规则 |
|---|------|----------|
| 1 | 是否新增了 Provider 的直接暴露？ | CONST-005 |
| 2 | 是否新增了 Workspace → Core 的直接依赖？ | CONST-004 |
| 3 | 是否绕过了 Adapter 层？ | CONST-011 |
| 4 | 是否新增了业务逻辑进入 Runtime？ | CONST-007 |
| 5 | 是否破坏了任何已发布的 Capability Contract？ | CONST-006 |
| 6 | 是否引入了跨 Center 循环依赖？ | CONST-001 |
| 7 | 是否新增了未认证的 API 端点？ | CONST-010 |
| 8 | 是否在 Workspace 中引入了 Provider 名称？ | CONST-012 |
| 9 | 是否在 Platform 中引用了 Workspace 代码？ | CONST-003 |
| 10 | 是否新增了 Adapter 放在 Platform 目录？ | CONST-013 |
| 11 | 是否引入了 Provider SDK 到核心模块？ | CONST-002 |
| 12 | 是否新增了不可观测的 AI 调用？ | CONST-008 |
| 13 | 是否在 Adapter 中包含了业务逻辑？ | CONST-014 |
| 14 | 是否在 Workspace 中暴露了 Credential？ | CONST-015 |
| 15 | 是否变更了跨 Workspace 数据共享方式？ | CONST-016 |
| 16 | 是否新增了 Center 但未实现健康检查？ | CONST-017 |
| 17 | 是否新增了 Capability 但未经过架构评审？ | CONST-018 |
| 18 | 是否新增了无法被 OpenClaw 自动审计的规则？ | CONST-019 |
| 19 | 新模块是否明确归属于某一 Architecture Layer？ | CONST-020 |
| 20 | 是否新增了跨层引用（如 Presentation → Runtime）？ | CONST-020 |
| 21 | 是否新增了无 State Owner 的状态？ | CONST-021 |
| 22 | 是否新增了跨 Center 同步 HTTP 调用而非事件？ | CONST-022 |
| 23 | 新增 Public Contract 是否缺少 Lifecycle Stage 声明？ | CONST-023 |
| 24 | 新增数据对象是否有明确 Owner Center？ | CONST-024 |
| 25 | 是否引入了一个数据的第二个 Truth Source？ | CONST-025 |
| 26 | 新增 Center 是否可替换（删除不影响其他）？ | CONST-028 |

### 评分标准

架构评审采用 100 分制，五维度各 20 分：

| 维度 | 分值 | 评审要点 |
|------|------|----------|
| Boundary | 20 | 职责边界是否清晰？是否有超出职责范围的逻辑？ |
| Dependency | 20 | 依赖矩阵是否符合 Constitution？是否有违规依赖？ |
| Data Ownership | 20 | 数据 Owner 是否明确？是否有双重真相源？ |
| Observability | 20 | 是否可观测？Trace/Logging/Health 是否完整？ |
| Security | 20 | 认证/授权/凭证管理是否符合 Constitution？ |

---

# Ch 8 — Evolution Policy

## 8.1 允许的新增

- 新的 Capability（在 Capability Registry 注册，附带 Schema）
- 新的 Provider（实现 Provider Adapter，在 AI Center 注册）
- 新的 Workspace（必须遵守 Workspace Contract）
- 新的 Adapter（放在 Workspace 目录下）
- 新的 Platform Center（满足依赖规则，通过架构评审）

## 8.2 禁止的变更

- Workspace 直接调用 Provider
- Platform import Workspace
- Runtime 包含业务逻辑
- 已发布 Capability 的名称变更
- 跨 Center 循环依赖
- Workspace 直接访问其他 Workspace 数据库

## 8.3 修改流程

以下类型的变更必须经过 Architecture Review：

1. Capability Contract 变更（新增/修改/废弃）
2. Platform API Schema 变更
3. Adapter Contract 变更
4. Constitution Rule 新增/修改/废弃
5. Platform Center 新增
6. Center 职责边界调整

**流程**:
1. 提交 Architecture Change Proposal
2. Architecture Review Board 评审
3. 如果涉及 Constitution Rule 变更 → 全团队共识
4. 批准后更新 Constitution 版本号
5. CI Pipeline 更新合规检查规则

---

# Appendix: Document Hierarchy

```
KMKI Platform Constitution（本文件，最高级，不可违反）
  └── 定义 6 个设计目标 + 5 条哲学 + 29 条不可违反规则 + Capability Language + Centers
        └── KMKI Platform Blueprint
              ├── 定义 Centers 的具体实现方案、依赖图、API 设计
              |     ├── AI Center Specification
              |     ├── Runtime Center Specification
              |     ├── Capability Center Specification
              |     ├── Trust Center Specification
              |     ├── Asset Center Specification
              |     ├── Knowledge Center Specification
              |     ├── Identity Center Specification
              |     ├── Billing Center Specification
              |     ├── Observability Center Specification
              |     └── Developer Center Specification
              └── Workspace Specifications
                    ├── GEO Workspace Specification
                    ├── ShortDrama Workspace Specification
                    ├── Novel Workspace Specification
                    └── PPT Workspace Specification
                          └── Implementation Guides
```

---

> *This Constitution is a living document. It evolves only through deliberate, reviewed change. Every violation is a debt that must be repaid.*
