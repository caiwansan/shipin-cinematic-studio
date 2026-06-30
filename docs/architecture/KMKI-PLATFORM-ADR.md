# KMKI Platform Architecture Decision Records v1.0

> **Version**: 1.0  
> **Status**: Freeze  
> **Date**: 2026-07-20  
> **Context**: Blueprint v2.0 Review Candidate 已冻结，进入 Center Specifications 前补齐架构决策记录。
>
> 每一个 ADR 记录一个**已经做出的架构决定**，包括当时的约束、考虑的方案、最终选择和原因。
>
> **ADR 的价值**：新人不需要重新讨论，Review 直接引用，未来的架构变更可以追溯历史决策。

---

## ADR-001 — Why Center-based Architecture instead of Microservice-first

**Status**: Accepted  
**Date**: 2026-07-20

### Context
平台需要支持 10 个功能域（AI、Runtime、Capability、Trust、Observability 等），每个功能域需要独立的生命周期和替换策略。常见的微服务架构会将每个功能域作为一个独立服务部署。

### Considered Options
1. **Domain Microservices** — 每个功能域独立部署，gRPC 通信
2. **Monolith with Module Boundaries** — 单进程模块化
3. **Center-based** — 逻辑 Center 定义，物理部署灵活（可合并可拆分）
4. **Serverless Functions** — 每个操作独立函数

### Decision
采用 **Center-based Architecture**。Center 是逻辑边界，物理部署允许合并（开发环境单进程）或拆分（生产环境 Kubernetes 集群）。Center 之间通过 Gateway + Event Bus 通信，禁止直接数据库访问。

### Reason
- **Microservice 太重**：10 个功能域如果全部独立部署，运维成本远高于收益。KMKI 在可预见的未来不需要每个 Center 独立扩容。
- **Monolith 太死**：单模块无法满足 Center 可替换（CONST-028）要求。
- **Center 是均衡点**：逻辑上拆分明晰（每个 Center 有独立 Owner/Storage/Lifecycle），物理上弹性部署（10 个 Center 可合并为 3~5 个服务进程）。
- **迁移路径清晰**：先单进程部署，性能瓶颈出现时按 Center 拆出独立服务。

### Consequences
- 开发期复杂度低于微服务，高于单体
- 每个 Center 必须严格隔离数据存储
- Center 间通信只能通过 API 或 Event，不能共享内存

### References
- Constitution CONST-001（分层不可逆转）
- Constitution CONST-022（Center 间事件优先通信）
- CONST-028（Center 可替换）

---

## ADR-002 — Why Workspace never owns AI capability

**Status**: Accepted  
**Date**: 2026-07-20

### Context
在 GEO V1 实现中，Workspace 直接调用 Provider API（OpenAI/DeepSeek）。这种模式导致 Provider 更换时必须修改 Workspace 代码，且每个 Workspace 重复实现 Provider 选择、凭证管理、错误处理逻辑。

### Considered Options
1. **Workspace Owns AI** — Workspace 直接调用 Provider，平台仅提供辅助 SDK
2. **Platform Owns AI** — Workspace 通过 Platform Capability 间接调用
3. **Hybrid** — 核心能力走 Platform，边缘能力允许 Workspace 直连

### Decision
**Platform Owns AI**。Workspace 永远不知道 Provider。

### Reason
- Provider 会不断变化（API 升级、价格波动、新 Provider 出现）
- 如果每个 Workspace 都直接调用 Provider，更换 Provider 需要修改 4 个 Workspace（GEO/短剧/小说/PPT）
- 凭证管理集中化降低泄露风险
- Workspace Adapter 调用平台时使用 Capability 语义，不需要感知底层 Provider

### Consequences
- Workspace 开发变简单：只关心 Capability，不关心 Provider
- Platform 必须保持 Capability 的稳定性和可用性
- 新增 Provider 时，Workspace 不需要修改（仅仅是 AI Center 注册）

### References
- Constitution CONST-005（Capability 是唯一 AI 调用入口）
- Constitution CONST-006（Capability Contract 不可破坏）

---

## ADR-003 — Why Capability is OS, not SDK

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Capability 需要一个注册、发现、路由、执行的管理系统。问题是：做成一个 SDK（函数调用库），还是一个独立的 OS 层。

### Considered Options
1. **SDK 模式** — 封装一个 `capability.invoke()` 函数库，各服务 import 使用
2. **OS 模式** — Registry + Resolver + Policy Engine + Execution Pipeline 组合成一个完整的执行系统
3. **Gateway-only** — 仅仅做 HTTP 路由

### Decision
**OS 模式**。Capability OS 是平台的核心中间层，不是 SDK。

### Reason
- SDK 无法实现 Resolver 的动态策略切换（策略在服务端变更、客户端无法实时同步）
- SDK 无法集中管理 Capability 生命周期（已废弃的 Capability 仍被旧代码调用）
- SDK 模式下 Policy 分散在各服务中，无法统一审计
- SDK 模式下 Fallback 链只能通过客户端重试实现，无法使用平台级能力

### Consequences
- Capability OS 需要独立部署和运维
- Workspace 通过 Adapter 调用 Capability OS，不需要 import 任何 SDK
- Capability OS 的 Policy 变更对所有 Workspace 实时生效

### References
- Blueprint Ch 3（Capability Operating System）
- CONST-005

---

## ADR-004 — Why Runtime never contains business logic

**Status**: Accepted  
**Date**: 2026-07-20

### Context
GEO V1 的 Runtime 包含了品牌知识处理逻辑。这导致 Runtime 无法被其他 Workspace 复用，且每次业务变更都需要修改 Runtime。

### Considered Options
1. **Fat Runtime** — Runtime 包含执行业务逻辑
2. **Pure Runtime** — Runtime 只负责执行，业务逻辑在 Capability OS 或 Workspace
3. **Thin Runtime with Middleware** — Runtime 通过插件链执行业务逻辑

### Decision
**Pure Runtime**。Runtime 只做一件事：执行 AI 调用并返回结果。不包含任何业务逻辑。

### Reason
- Runtime 是平台最底层、变更最频繁的模块（Provider SDK 更新、超时策略调整、重试逻辑优化）
- 如果 Runtime 包含业务逻辑，每次业务变更都需要修改 Runtime，违反关注点分离
- Pure Runtime 可以被所有 Workspace 共享
- Runtime 的稳定性（不出错、不超时、可追踪）是最重要的，业务逻辑会增加出错面

### Consequences
- 业务逻辑上移到 Capability OS（Policy Engine）和 Workspace（Adapter）
- Runtime 可以持续优化执行性能而不影响业务
- Runtime 团队只需要关注执行可靠性，不需要理解业务

### References
- Constitution CONST-007（Runtime 不允许出现业务逻辑）
- Blueprint Ch 4（Runtime Architecture）

---

## ADR-005 — Why Event-first instead of HTTP-first

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Center 之间需要通信。HTTP（同步）和 Event（异步）是两种主选方案。

### Considered Options
1. **HTTP-first** — 所有跨 Center 通信走 HTTP/gRPC
2. **Event-first** — 异步通信优先，同步只在必要时使用
3. **HTTP-only** — 全部同步

### Decision
**Event-first**。Center 间通信优先使用 Event Bus，HTTP/gRPC 仅用于请求-响应模式的必要场景（如 Capability.invoke）。

### Reason
- 事件解耦：Publisher 不需要知道 Subscriber，新 Center 注册为 Subscriber 即可
- 事件天然支持灰度/回滚：新版本发布时，旧版本仍在消费旧事件
- 事件提供审计回溯：事件日志本身就是操作记录
- 同步调用增加 Center 间的部署耦合

### When HTTP is allowed
- Capability.invoke（请求-响应是自然语义）
- 健康检查
- 配置查询

### Consequences
- Event Bus 成为平台的关键基础设施
- 每个事件必须定义 Schema 和版本
- Subscriber 必须幂等

### References
- Constitution CONST-022
- Blueprint Ch 7

---

## ADR-006 — Why Provider Adapter is isolated from Platform Core

**Status**: Accepted  
**Date**: 2026-07-20

### Context
需要集成多个 AI Provider（OpenAI / DeepSeek / Claude / Qwen 等）。Provider SDK 各有不同。

### Considered Options
1. **Direct SDK Import** — Platform Core 直接 import Provider SDK
2. **Isolated Adapter** — 每个 Provider 独立封装，Platform Core 通过接口调用
3. **Sidecar Process** — Provider SDK 作为独立 Sidecar 进程
4. **Dynamic Plugin** — Adapter 作为可下载的 Plugin

### Decision
**Isolated Adapter**，每个 Provider 封装为独立的 `ProviderAdapter` 实现类。Platform Core 只依赖 `ProviderAdapter` 接口，不依赖任何 Provider SDK。

### Reason
- Provider SDK 依赖版本冲突：OpenAI SDK v5 和 DeepSeek SDK v2 可能共享同个底层库的不同版本
- Provider SDK 的安全性：Provider SDK 可能引入外部依赖的漏洞，隔离后可单独审计
- Provider SDK 更新频率不同，隔离后可以独立升级
- Platform Core 不因 Provider SDK 变更而变更
- Isolated Adapter 足够（不需要 Sidecar 或 Plugin 的部署复杂性）

### Consequences
- Platform Core 依赖 `ProviderAdapter` 接口，不依赖任何 Provider SDK
- 新增 Provider 只需要实现 `ProviderAdapter` 接口 + 注册到 AI Center
- Provider Adapter 独立打包，可与 Platform Core 同进程运行
- Provider SDK 的漏洞风险被隔离在 Adapter 内

### References
- Constitution CONST-002（核心模块不依赖 Provider SDK）
- Blueprint Ch 6（Provider Adapter Specification）

---

## ADR-007 — Why data has a single owner

**Status**: Accepted  
**Date**: 2026-07-20

### Context
数据在多个 Center 之间共享。GEO V1 中，同一个实体（如知识对象）被多个服务读写，导致数据不一致。

### Considered Options
1. **Multi-writer** — 多个 Center 可以直接修改同一个数据
2. **Single Owner + API** — 每个数据对象只有一个 Owner Center，其他 Center 通过 API 读取
3. **Event Sync** — 数据变更通过 Event 同步到其他 Center 的本地副本

### Decision
**Single Owner + Event Sync**。每个数据对象只有一个 Owner Center。Owner 负责写入。其他 Center 通过 API 读取，或通过 Event 获取数据变更通知（可缓存在本地）。

### Reason
- Multi-writer 必然导致数据不一致（谁最后写谁对？冲突如何解决？）
- Single Owner 是一种强约束，迫使设计者在事前明确"谁负责什么"
- Event Sync 允许其他 Center 建立本地缓存而不破坏 Owner 原则
- Owner 对自己负责的数据有完整的生命周期管理能力

### Consequences
- 每个 Center 必须声明自己的数据所有权
- 其他 Center 需要数据时，必须先请求 Owner Center 的 API
- Event 可以用于数据变更通知，但不可替代 Owner API

### References
- Constitution CONST-024（数据对象唯一 Owner）
- Constitution CONST-025（单一真相源）
- Constitution CONST-027（读取不创建依赖）
- Blueprint Ch 8

---

## ADR-008 — Why Trace is first-class citizen, not just logs

**Status**: Accepted  
**Date**: 2026-07-20

### Context
AI 调用跨越多个 Center（Gateway → Capability → Runtime → Provider），每次调用消耗 Token 并产生成本。调试时需要串联整个调用链。

### Considered Options
1. **Log-only** — 依赖日志 + grep 调试
2. **Metric-only** — 只记录聚合指标
3. **Trace-first** — 分布式追踪作为一级结构

### Decision
**Trace-first**。每个 AI 调用产生一个 Trace，贯穿所有 Center。Trace 包含：Trace ID / Span 树 / 时间戳 / 错误 / Token 消耗。

### Reason
- AI 调用的成本敏感：一个 Trace 包含 Token 消耗信息，可用于 Billing
- AI 调用的长链路：一次 Gen 可能经过 Prompt 增强 → 模型调用 → 输出验证 → 重试 → Fallback
- 日志不足以重建调用链（多服务、多线程环境下日志时间戳不可靠）
- 聚合指标不足以调试单个调用问题
- Trace 是 Log 和 Metric 的桥梁：Trace 可以导出 Log（Span 详情）和 Metric（聚合统计）

### Consequences
- 所有 Center 必须透传 Trace Context
- Gateway 入口生成 Trace ID
- Trace 数据量较大，需要采样策略（高 QPS 接口 10% 采样，错误调用 100% 采样）
- Trace 存储选型：Elasticsearch（APM）或 ClickHouse（自建）

### References
- Constitution CONST-008（所有 AI 调用必须可追踪）
- Blueprint Ch 9（Observability）

---

## ADR-009 — Why Capability Resolution follows Permission → Lifecycle → Health → Cost → Latency

**Status**: Accepted  
**Date**: 2026-07-20

### Context
当一个 Capability 对应多个 Provider/Model 时，Resolver 需要选择一个最优组合。选择顺序直接影响用户体验和成本。

### Considered Options
1. **Cost-first** — 总是选最便宜的
2. **Latency-first** — 总是选最快的
3. **Hard-code Pin** — 开发人员硬编码指定
4. **Resolution Chain** — 按优先级逐步过滤

### Decision
**Resolution Chain**：Permission → Tenant → Lifecycle → Health → Cost Policy → Latency Policy → Build Fallback Chain。

### Reason
- Cost-first 可能选到不可用的 Provider（health down）
- Latency-first 可能选到不支持的模型（capability 不支持）
- 硬编码指定无法应对 Provider 变化
- Resolution Chain 确保安全（权限/租户/健康）优先于优化（成本/延迟）
- 每层过滤减少候选集，最后一层做最优选择

### Consequences
- Resolver 必须维护 7 个过滤器
- Model Profile 必须提供所有过滤所需字段
- Fallback Chain 确保主 Provider 失败后有备选

### References
- Blueprint Ch 3.5（Capability Resolution Algorithm）

---

## ADR-010 — Why Trust Center is platform-wide, not GEO-specific

**Status**: Accepted  
**Date**: 2026-07-20

### Context
GEO V1 实现了 Evidence Framework，用于品牌知识的事实核查。问题是：其他 Workspace（短剧、小说）也有可信度需求。

### Considered Options
1. **GEO-only Trust** — Trust 逻辑留在 GEO Workspace
2. **Platform Trust Center** — 跨 Workspace 的通用信任框架
3. **Trust as Capability** — 推理可信度作为一个 Capability

### Decision
**Platform Trust Center**。Trust Center 是一个独立的 Center，提供通用的信任分数计算引擎。各 Workspace 通过 Capability 调用 Trust Center，注入自己的工作数据（证据、引用、声明）。

### Reason
- 短剧工作台需要验证历史人物描述与事实的一致性
- 小说工作台需要验证引用来源的可信度
- PPT 工作台需要验证数据引用的来源可靠性
- 将 Trust 放在 Workspace 各自实现导致 4 次重复
- Trust Center 不存储业务数据，只存储信任分数和证据标识

### Consequences
- Trust Center 的 API 必须是通用的（不假设 GEO 的数据模型）
- Each Workspace implements its own Evidence Adapter
- Trust Score 在 Knowledge Center 中作为 KO 的一个属性存在

### References
- Blueprint Ch 5.7（Trust Center）

---

## ADR-011 — Why Gateway is the single entry point

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Platform 需要统一管理认证、限流、路由。问题在于是否允许 Workspace 或 Center 暴露直接服务端口。

### Considered Options
1. **Gateway-only** — 所有外部请求经过 Gateway
2. **Direct Center Access** — Center 可以直接对外暴露 API
3. **Hybrid** — 核心 API 走 Gateway，调试 API 直接暴露

### Decision
**Gateway-only for production**。所有外部请求必须经过 Gateway。开发环境允许 Center 直接暴露调试端口。

### Reason
- 认证/授权集中化：Gateway 执行 JWT 验证，Center 不需要各自实现 Auth
- 限流集中化：Gateway 执行租户级限流
- Trace ID 统一生成：Gateway 注入 Trace Context
- Gateway 是运维的单一控制点

### Consequences
- Gateway 成为单点，需要高可用部署（至少 2 个实例）
- 新增 API 需要在 Gateway 注册路由
- 开发环境允许绕过 Gateway 以加速调试

### References
- Blueprint Ch 2

---

## ADR-012 — Why each Center has its own data repository

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Center 需要存储数据。问题是共享数据库还是独立存储。

### Considered Options
1. **Shared Database** — 所有 Center 共享同一个数据库
2. **Independent Schema** — 同一数据库实例、独立 Schema
3. **Independent Database** — 每个 Center 独立数据库实例
4. **Independent + Event Sync** — 独立数据库 + 事件同步

### Decision
**Independent Schema per Center**。同一 PostgreSQL 实例，使用独立 Schema 隔离。生产环境中可以根据需要升级为独立数据库实例。

### Reason
- Shared Database 导致耦合（一个 Center 的表结构变更影响其他 Center）
- Independent Database 运维成本高（10 个 Center 需要 10 个数据库连接池）
- Independent Schema 在隔离性和运维成本之间取得平衡
- 升级路径清晰：Schema → 独立 Database（使用 PostgreSQL FDW 或逻辑复制）
- Center 间访问数据必须通过 API，不能直接连数据库

### Consequences
- 每个 Center 的数据库 Schema 文件独立管理
- 跨 Center 查询必须通过 API，不能使用 SQL JOIN
- 数据库迁移脚本按 Schema 隔离

### References
- Blueprint Ch 8
- ADR-007（Single Owner Data Model）

---

## ADR-013 — Why Schema evolution follows add-only with backward compatibility

**Status**: Accepted  
**Date**: 2026-07-20

### Context
API 和 Event Schema 会随时间演进。问题是：如何在不破坏消费者的情况下变更 Schema。

### Considered Options
1. **Breaking Changes Allowed** — 允许破坏性变更，消费者必须同步更新
2. **Add-only** — 只支持新增字段，不支持修改/删除
3. **Versioned Schema** — Schema 版本化，新旧版本共存

### Decision
**Add-only for minor, Versioned for major**。向后兼容的变更（新增字段）使用 Add-only。破坏性变更使用新版本，旧版本维持 deprecated 期 3 个月。

### Reason
- Add-only 对消费者影响最小
- Versioned Schema 用于无法向后兼容的场景
- deprecated 期给消费者充分的迁移时间

### Consequences
- API 响应中新增字段不会导致消费者出错
- 废弃字段保持 deprecated 3 个月后删除
- Event Schema 通过版本号（event.v1 → event.v2）区分

### References
- Constitution CONST-023（公共契约生命周期）

---

## ADR-014 — Why Capability lifecycle uses 5 stages

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Capability 需要从设计到废弃的完整生命周期管理。

### Considered Options
1. **2 stages** — active / inactive
2. **3 stages** — active / deprecated / removed
3. **5 stages** — experimental / preview / stable / deprecated / removed

### Decision
**5 stages**。

### Reason
- experimental：允许快速迭代，不承诺稳定性
- preview：稳定但未完成验证，消费者需知晓风险
- stable：完整验证，承诺向后兼容
- deprecated：通知消费者迁移，3 个月后移除
- removed：Consumer 调用返回 404

### Consequences
- Capability Registry 必须维护每个 Capability 的 lifecycle 字段
- Resolver 在 Lifecycle Filter 中优先选择 stable
- Consumer 可以通过 API 查询 Capability 的 lifecycle 状态

### References
- Constitution CONST-023
- Blueprint Ch 3

---

## ADR-015 — Why Event versioning uses source.action.version format

**Status**: Accepted  
**Date**: 2026-07-20

### Context
事件名称需要唯一标识并支持版本演进。

### Considered Options
1. **Versionless** — 事件名不包含版本
2. **Semver suffix** — `event-v2` 后缀
3. **source.action.version** — `provider.registered.v1`

### Decision
**source.action.version** 格式。

### Reason
- Versionless 无法区分 Schema 变更
- source 标识事件来源（方便事件管理和过滤）
- action 标识事件语义
- version 在文件末尾，读取时先忽略版本

### Consequences
- 事件版本变更时，新版本创建新 Topic
- 消费者需要声明订阅的事件版本
- Event Bus 支持 Topic Pattern 匹配（`provider.*.v1` 匹配所有 provider 相关事件）

### References
- Blueprint Ch 7

---

## ADR-016 — Why Provider lifecycle includes Degraded state

**Status**: Accepted  
**Date**: 2026-07-20

### Context
AI Provider 的可用性不可控（OpenAI 经常限流、DeepSeek 偶尔宕机）。Platform 需要感知 Provider 的实时状态。

### Considered Options
1. **Binary Health** — up / down
2. **Tiered Health** — healthy / degraded / down
3. **Continuous Health Score** — 0~100 的健康分

### Decision
**Tiered Health**。

### Reason
- Binary 无法处理"慢了但没挂"的情况
- Continuous Score 过度设计（Platform 只需要知道是否可用，不需要知道 87 分还是 92 分）
- degraded 是关键状态：Provider 可用但延迟高/错误率高，Resolver 应避免路由但允许手动指定

### Consequences
- Health Registry 定期检查每个 Provider 的 health()
- 连续 3 次检查失败自动标记 degraded
- 连续 5 次失败标记 down
- Resolver 在 Health Filter 阶段排除 degraded Provider（除非手动优先指定）

### References
- Blueprint Ch 5.3（AI Center）

---

## ADR-017 — Why Workspace can be deleted and rebuilt

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Constitution 1.7 原则：Workspace 可删除重建。问题在于 Platform 是否存储 Workspace 的数据。

### Considered Options
1. **Platform owns Workspace data** — Platform 存储所有数据
2. **Workspace owns its data** — Workspace 数据存储在 Workspace 存储层
3. **Hybrid** — 共享数据（如知识对象）在 Platform，业务数据在 Workspace

### Decision
**Hybrid**。Workspace 的业务数据在 Workspace 内，Platform 不感知。Workspace 删除后，Platform 仅清除与该 Workspace 相关的关联记录。

### Reason
- Platform 不应该成为 Workspace 的持久化存储
- Workspace 可以随时重建，重建后重新注册到 Platform
- Platform 不存储 Workspace 的业务数据

### Consequences
- Workspace Adapter 负责数据转换
- Platform 只维护 Workspace 的元数据和配额信息

### References
- Constitution 1.7

---

## ADR-018 — Why Runtime uses a 10-state machine

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Runtime 需要跟踪每个 Execution Plan 的精确状态。GEO V1 仅有 pending / running / done / failed 四种状态。

### Considered Options
1. **4 states** — pending / running / done / failed
2. **6 states** — pending / queued / running / succeeded / failed / cancelled
3. **10 states** — Created / Queued / Planning / Dispatching / Running / Streaming / Completed / Failed / Cancelled / TimedOut

### Decision
**10-state machine**。

### Reason
- 4 个状态无法区分"排队中"和"运行中"，也无法跟踪重试和流式
- 10 个状态可以精确追踪每个 Execution Plan 的执行细节
- 状态机为 Recovery（失败后从指定状态恢复）提供基础
- 状态变更记录为 Trace Span，提供完整的执行画像

### Consequences
- Runtime 必须实现状态持久化和幂等更新
- 状态变更触发事件（`runtime.completed.v1`, `runtime.failed.v1`）
- 状态机禁止跳跃（如从一个状态直接跳到 Completed）

### References
- Blueprint Ch 4.1（Execution State Machine）

---

## ADR-019 — Why Storage isolation prevents cross-Center data coupling

**Status**: Accepted  
**Date**: 2026-07-20

### Context
Center 之间共享数据的需求会自然导致直接数据库访问。

### Considered Options
1. **Cross-Center Database Access** — Center A 直接查询 Center B 的数据库
2. **API-only** — Center 间数据访问必须通过 API
3. **API + Local Cache** — 优先 API，允许通过 Event 同步数据到本地缓存

### Decision
**API + Event Cache**。禁止直接数据库访问。允许通过 Event 同步数据到本地缓存。

### Reason
- 直接访问数据库导致 Center 之间存储耦合
- Center B 改表结构会破坏 Center A 的查询
- API 是 Center 之间最小的公共契约（只需要保证 API 稳定）
- Event Cache 降低读取延迟，不破坏数据所有权

### Consequences
- 每次跨 Center 数据访问增加一次网络调用
- 需要权衡缓存策略（TTL、失效通知）
- 违反此原则的代码在 Architecture Review 中直接否决

### References
- Constitution CONST-024
- CONST-027

---

## ADR-020 — Why Platform evolution follows Design → ... → Archive 9 stages

**Status**: Accepted  
**Date**: 2026-07-20

### Context
平台需要从概念到废弃的完整生命周期管理，确保每次变更都可追溯、可控。

### Considered Options
1. **3 stages** — dev / staging / prod
2. **5 stages** — design / develop / test / deploy / maintain
3. **9 stages** — Design → Register → Validate → Deploy → Observe → Optimize → Deprecate → Replace → Archive

### Decision
**9-stage lifecycle**。覆盖从设计到归档的完整过程。

### Reason
- 3 阶段只覆盖部署，不覆盖生命周期
- 5 阶段缺少 Register / Deprecate / Replace / Archive（平台特有需求）
- Register 是平台特有的阶段（Center/Capability 注册到 Developer Center）
- Archive 确保已废弃的组件不会在代码库中腐烂

### Consequences
- 每个 Center 必须声明其 Lifecycle Stage
- Architecture Review 必须在 Design 阶段完成
- Archive 的组件必须标记，代码库不可用

### References
- Blueprint Ch 10

---

## Appendix: ADR Index

| # | Title | Key Decision |
|---|-------|--------------|
| 001 | Center-based Architecture | Center 是逻辑边界，物理部署灵活 |
| 002 | Workspace never owns Capability | Workspace 通过 Platform 间接调用 AI |
| 003 | Capability is OS, not SDK | Registry + Resolver + Policy + Pipeline |
| 004 | Runtime is pure | Runtime 不包含业务逻辑 |
| 005 | Event-first | Center 间事件优先，HTTP 仅用于必要场景 |
| 006 | Provider Adapter Isolation | Adapter 独立，Platform Core 只依赖接口 |
| 007 | Single Owner Data | 每个数据对象唯一 Owner |
| 008 | Trace-first | Trace 是一级公民 |
| 009 | Capability Resolution Chain | Permission → Lifecycle → Health → Cost → Latency |
| 010 | Trust Center is platform-wide | 不是 GEO-specific |
| 011 | Gateway single entry | 所有外部请求经过 Gateway |
| 012 | Independent Schema | 每个 Center 独立数据库 Schema |
| 013 | Add-only Schema Evolution | 向后兼容优先 |
| 014 | 5-stage Capability Lifecycle | experimental → preview → stable → deprecated → removed |
| 015 | source.action.version 格式 | 事件版本格式 |
| 016 | Tiered Health | healthy / degraded / down |
| 017 | Workspace deletable & rebuildable | Platform 不存储 Workspace 业务数据 |
| 018 | 10-state Execution Machine | Runtime 精确状态追踪 |
| 019 | API-only Cross-Center Data | 禁止直连数据库 |
| 020 | 9-stage Platform Lifecycle | Design → ... → Archive |

---

> *每个 ADR 记录决策、原因和后果。未来新增架构决策时，在此文件末尾追加新 ADR。*
