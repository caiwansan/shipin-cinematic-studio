# V4.1 Capability Registry（CR）

> **文档版本**: v1.0  
> **基线日期**: 2026-07-19  
> **状态**: V4.1 Architecture Freeze 核心交付物  
> **目的**: 注册全平台已有能力，指导新增功能复用还是新建

---

## 1. 能力注册表

| Capability | 状态 | 类型 | 首个消费方 | 实现位置 | 备注 |
|-----------|------|------|-----------|---------|------|
| **Provider Runtime** | ✅ Stable | Platform | 全工作台 | `backend/src/services/platform/resource/` | PLAT-008，已冻结 |
| **Capability Platform** | ✅ Stable | Platform | 全工作台 | `backend/src/services/platform/capability/` | PLAT-006，已冻结 |
| **Execution Runtime** | ✅ Stable | Platform | 全工作台 | `backend/src/services/platform/execution/` | PLAT-007，已冻结 |
| **Workspace Runtime** | ✅ Stable | Platform | 全工作台 | `backend/src/services/platform/workspace/` | PLAT-009，已冻结 |
| **Agent Runtime** | ✅ Stable | Platform | 全工作台 | `backend/src/services/platform/agent/` | PLAT-010，已冻结 |
| **Workflow Runtime** | ✅ Stable | Platform | 全工作台 | `backend/src/services/platform/workflow/` | PLAT-011，已冻结 |
| **Platform Governance** | ✅ Stable | Platform | 全工作台 | `backend/src/services/platform/governance/` | PLAT-012，已冻结 |
| **Execution Engine (Kernel)** | ✅ Freeze | Platform | 全工作台 | `packages/studio-platform/src/execution/` | V4.1 Kernel |
| **Capability Orchestrator** | ✅ Freeze | Platform | 全工作台 | `packages/studio-platform/src/capability/` | V4.1 Kernel |
| **Citation** | ✅ Active | Core | GEO | `backend/src/core/citation/` | P2.1，GEO 已验证 |
| **GEO Citation Adapter** | ✅ Active | Workspace | GEO | `backend/src/services/geo/adapters/citation/` | GEO 特有的引用处理 |
| **GEO Knowledge Agents** | ✅ Active | Workspace | GEO | `backend/src/services/geo/agents/` | 5 个 Agent: citation, claim, entity, evidence, faq |
| **Knowledge Object** | ✅ Active | Core | GEO | `backend/src/services/geo/runtime/knowledge/` | 知识对象生命周期 |
| **Auth Service** | ✅ Active | Platform | 全工作台 | `backend/src/services/auth.service.ts` | JWT 验证 |
| **Asset Center** | ⚠️ Active | Core | 全工作台 | `backend/src/core/asset-economy/` + `backend/src/services/asset/` | 路由已注册 |
| **Payment** | ✅ Active | Platform | 全工作台 | `backend/src/payment/` | 微信 + 支付宝 |
| **Billing & 会员** | ✅ Active | Platform | 全工作台 | `backend/src/services/balance/` | Quota + Subscription |
| **Semantic Engine** | ⚠️ Active | Core | Short-drama, GEO | `backend/src/services/semantic/` | 语义实体/关键词 |
| **Observability** | ✅ Active | Platform | 全工作台 | `backend/src/services/observability.service.ts` | 链路追踪 |
| **Task Queue** | ✅ Active | Platform | 全工作台 | `backend/src/queue/` | Redis 任务队列 |
| **Worker Pool** | ✅ Active | Platform | 全工作台 | `backend/src/services/worker-pool.service.ts` | Worker 管理 |
| **Evidence** | 📋 Planned | Core | GEO, 小说 | P2.2 | 依赖 Citation |
| **Claim** | 📋 Planned | Core | GEO, 小说 | P2.3 | 依赖 Evidence |
| **Trust Engine** | 📋 Planned | Core | 全工作台 | P2.4 | 依赖 Citation + Evidence + Claim |
| **kmki-ui** | ⚠️ Planned | UI | 全工作台 | `frontend/components/kmki-ui/` | 首批 5 组件 |
| **Event Bus** | ❌ Stub | Platform | 全工作台 | `packages/studio-platform/src/event/` | 内存实现，需生产级 |
| **State Runtime** | ❌ Stub | Platform | 全工作台 | `packages/studio-platform/src/state/` | 内存实现 |
| **Admin** | 🚧 Incomplete | Admin | 全工作台 | `frontend/pages/director-os/` | 独立里程碑，建设中 |
| **Short-drama Pipeline** | ✅ Active | Workspace | Short-drama | `backend/src/services/video-pipeline.engine.ts` | 短剧特有 |
| **Storyboard** | ✅ Active | Workspace | Short-drama | `backend/src/services/storyboard.service.ts` | 分镜管理 |
| **GEO Search** | ✅ Active | Workspace | GEO | `backend/src/services/geo/` | GEO 知识检索 |
| **GEO Workflow** | ✅ Active | Workspace | GEO | `backend/src/services/geo/registry/geo-workflow.ts` | GEO 工作流注册 |
| **Community** | ✅ Active | Platform | 全用户 | `backend/src/routes/community/` | 帖子/评论/分类 |

---

## 2. 能力复用决策树

新功能在决定"新增还是复用"时，按以下流程判断：

```
新功能需求
    │
    ├── 检查 Capability Registry 是否有同类能力
    │   ├── 有 → 复用（通过 SDK 接口调用）
    │   └── 无 → 继续
    │
    ├── 评估是否多个工作台会用到
    │   ├── 是 → 作为 Core 层新增能力
    │   └── 否 → 作为 Workspace 内部实现
    │
    ├── 如果是新增 Core 能力：
    │   ├── 需要新增 API → 放入 /api/platform/[module]/
    │   ├── 需要新增数据库表 → 在对应域 .prisma 中定义
    │   └── 需要新增 Admin 菜单 → 注册到 Director OS
    │
    └── 如果是 Workspace 内部能力：
        ├── 放在 workspace/[name]/ 下
        └── 不注册为平台能力
```

---

## 3. 能力状态定义

| 状态 | 含义 | 后续行动 |
|------|------|---------|
| ✅ Stable | 已冻结，生产可用，API 稳定 | 维护 |
| ✅ Freeze | 已冻结，但尚未生产验证 | 部署验证 |
| ✅ Active | 活跃开发中，可用 | 持续迭代 |
| ⚠️ Active | 活跃开发中，有已知差距 | 补齐差距 |
| 📋 Planned | 已规划，未开始实现 | 排期开发 |
| 🚧 Incomplete | 已部分实现，未完成 | 评估完成度 |
| ⏸️ Deprecate | 废弃，保留但不开发 | 迁移到替代方案 |
| ❌ Stub | 仅存在接口定义，无实现 | 实现或删除 |

---

## 4. 能力依赖图

```
┌─ Workflow Runtime ─┐
│  PLAT-011           │──────┐
└────────────────────┘      │
                            ▼
┌─ Agent Runtime ────┐ ┌──────────────┐
│  PLAT-010           │→│ Capability    │
└────────────────────┘ │ Platform      │
                       │ PLAT-006      │────Provider Registry
┌─ Workspace Runtime ┐ │              │
│  PLAT-009           │→│              │
└────────────────────┘ └──────────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │ Execution Runtime│
                   │ PLAT-007          │
                   └──────────────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │ Platform Gov     │
                   │ PLAT-012          │
                   │ (Cross-cutting)   │
                   └──────────────────┘

┌─ Citation ──┐ → ┌─ Evidence ──┐ → ┌─ Claim ──┐ → ┌─ Trust Engine ──┐
│  P2.1 ✅    │    │  P2.2 📋   │    │  P2.3 📋 │    │  P2.4 📋        │
└─────────────┘    └────────────┘    └──────────┘    └─────────────────┘
```

---

## 5. 新增能力指引

| 场景 | 推荐方案 | 不推荐方案 |
|------|---------|-----------|
| 调用 AI 模型 | 复用 Provider Runtime (PLAT-008) | 自己封装 HTTP 调用 |
| 执行异步任务 | 复用 Execution Runtime (PLAT-007) | 自建队列 |
| 需要工作流编排 | 复用 Workflow Runtime (PLAT-011) | 自写 DAG 引擎 |
| 需要 Agent 协作 | 复用 Agent Runtime (PLAT-010) | 自建 Agent 框架 |
| 需要知识引用 | 复用 Citation Engine (P2.1) | 自建引用系统 |
| 需要 UI 组件 | 复用 kmki-ui（建设中） | 自建组件库副本 |
| 需要事件通知 | 待 Event Bus 完善后复用 | 直接消息队列调用 |
| 需要治理/授权 | 复用 Governance (PLAT-012) | 自己实现鉴权 |

---

> **文档历史**
> | 版本 | 日期 | 变更 |
> |------|------|------|
> | v1.0 | 2026-07-19 | 初次建立 — V4.1 Architecture Freeze |
