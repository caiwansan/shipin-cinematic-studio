# V4.1 Module Ownership Map（MOM）

> **文档版本**: v1.0  
> **基线日期**: 2026-07-19  
> **状态**: V4.1 Architecture Freeze 核心交付物  

---

## 概述

本文件定义昆仑镜平台每个模块的层级归属、负责人、允许依赖关系和当前状态。所有数据基于审计扫描的真实代码结构。

---

## 全局模块清单

| 模块 | 层级 | 负责人 | 允许依赖 | 状态 | 路径 |
|------|------|--------|---------|------|------|
| `@studio/platform` SDK | Core | Platform Team | 无外部依赖（纯 TS） | ✅ Freeze v4.0 | `packages/studio-platform/` |
| Execution Engine | Core | Platform Team | SDK, Database | ✅ Freeze v4.1 | `packages/studio-platform/src/execution/` |
| Capability Orchestrator | Core | Platform Team | SDK, Database | ✅ Freeze v4.1 | `packages/studio-platform/src/capability/` |
| Capability Runtime | Core | Platform Team | Database | ✅ Active | `backend/src/services/platform/capability/` |
| Execution Runtime | Core | Platform Team | Capability, Database | ✅ Active | `backend/src/services/platform/execution/` |
| Workspace Runtime | Core | Platform Team | Capability, Execution | ✅ Active | `backend/src/services/platform/workspace/` |
| Agent Runtime | Core | Platform Team | Capability, Execution, Workspace | ✅ Active | `backend/src/services/platform/agent/` |
| Workflow Runtime | Core | Platform Team | Capability, Execution, Agent | ✅ Active | `backend/src/services/platform/workflow/` |
| Resource Runtime | Core | Platform Team | Capability, Database | ✅ Active | `backend/src/services/platform/resource/` |
| Governance | Core | Platform Team | 全 Core 模块 | ✅ Active | `backend/src/services/platform/governance/` |
| Event Bus | Core | Platform Team | 无 | ❌ Stub | `packages/studio-platform/src/event/` |
| Citation Engine | Core | Knowledge Infra | Runtime, Database, Provider | ✅ Active | `backend/src/core/citation/` |
| Evidence Engine | Core | Knowledge Infra | Citation, Database | 📋 Planned | P2.2 |
| Claim Engine | Core | Knowledge Infra | Evidence, Database | 📋 Planned | P2.3 |
| Trust Engine | Core | Knowledge Infra | Citation, Evidence, Claim | 📋 Planned | P2.4 |
| Asset Economy | Core | Platform Team | Database, Storage | ⚠️ Active | `backend/src/core/asset-economy/` + `backend/src/services/asset/` |
| Asset Frontend | Core | Platform Team | Asset API | ⚠️ Active | `frontend/modules/asset/` |
| Governance Core | Core | Platform Team | Database | ✅ Active | `backend/src/core/governance/` + `backend/src/core/control-plane/` |
| Agent Graph | Core | Platform Team | Capability | ✅ Active | `backend/src/core/agent-graph/` |
| Policy Adapter | Core | Platform Team | Database | ✅ Active | `backend/src/core/policy-adapter/` |
| Runtime (Backend) | Core | Platform Team | 全 Core, Database | ⚠️ Legacy | `backend/src/runtime/` |
| Short-drama Workspace | Workspace | Studio Team | Core, Adapter, kmki-ui | ✅ Active | `frontend/studio-v2/workspace/director/` |
| Novel Workspace | Workspace | Studio Team | Core, Adapter, kmki-ui | ⚠️ Legacy | `frontend/pages/novel/` |
| GEO Workspace (frontend) | Workspace | GEO Team | Core, Adapter, kmki-ui | ✅ Active | `frontend/studio-v2/workspace/brand-geo/` |
| GEO Workspace (backend) | Workspace | GEO Team | Core, Database | ✅ Active | `backend/src/services/geo/` |
| GEO Knowledge Agents | Workspace | GEO Team | Citation, Evidence, Claim | ✅ Active | `backend/src/services/geo/agents/` |
| Music Workspace | Workspace | Studio Team | Core | ⚠️ Incomplete | `frontend/studio-v2/workspace/music-generation/` |
| Advertisement Workspace | Workspace | Studio Team | Core | ⚠️ Incomplete | `frontend/studio-v2/workspace/advertisement/` |
| HDZ (混洞织) | Workspace | HDZ Team | Core | ⚠️ Incomplete | `frontend/pages/hdz/` + `backend/src/routes/hdz/` |
| kmki-ui | Shared UI | Platform Team | 无业务依赖 | ⚠️ Planned | `frontend/components/kmki-ui/` |
| Admin (Director OS) | Admin | Platform Team | Core, Database | ✅ Active | `frontend/pages/director-os/` |
| Admin (Legacy) | Admin | Platform Team | Core | ⏸️ Deprecate | `frontend/pages/admin/` |
| Admin Routes | Admin | Platform Team | Core Services | ✅ Active | `backend/src/routes/admin-*` |
| Prisma Database | Database | Platform Team | 无 | ✅ Active | `backend/prisma/schema.prisma`（292 模型） |
| Queue System | Infrastructure | Platform Team | Database, Redis | ✅ Active | `backend/src/queue/` |
| Security | Infrastructure | Platform Team | Config | ✅ Active | `backend/src/security/` |
| Config | Infrastructure | Platform Team | 无 | ✅ Active | `backend/src/config/` |
| Workers | Infrastructure | Platform Team | Queue, Database | ✅ Active | `backend/src/workers/` |
| Payment | Core | Platform Team | Database, 外部支付 | ✅ Active | `backend/src/payment/` |
| Billing | Core | Platform Team | Database | ✅ Active | `backend/src/services/balance/` |
| Community | Workspace | Community Team | Core, Database | ✅ Active | `backend/src/routes/community/` |
| Semantic Engine | Core | Platform Team | Database | ⚠️ Active | `backend/src/services/semantic/` |
| Provider Registry | Core | Platform Team | Database | ✅ Active | `backend/src/core/provider-registry/` |
| Schema Runtime | Core | Platform Team | Database | ✅ Active | `backend/src/schema-runtime/` |
| Lifecycle Manager | Core | Platform Team | Event Bus | ⚠️ Active | `backend/src/services/lifecycle-manager.ts` |

---

## 层间依赖矩阵

| → 依赖方 \ 被依赖方 → | Workspace | Core SDK | Core (Service) | Admin | Database | kmki-ui | Infra |
|---|---|---|---|---|---|---|---|
| **Workspace** | ❌ | ✅ | ✅ | ❌ | ✅ (via Repo) | ✅ | ❌ |
| **Core SDK** | ❌ | N/A | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Core (Service)** | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Admin** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **kmki-ui** | ❌ | ❌ | ❌ | ❌ | ❌ | N/A | ❌ |
| **Infrastructure** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/A |

---

## 负责人备案

| Team | 负责模块 | 联系人 |
|------|---------|--------|
| **Platform Team** | 所有 Core 层 + Admin + kmki-ui + Infrastructure | 架构委员会 |
| **Studio Team** | Short-drama, Novel, Music, PPT Workspace | — |
| **GEO Team** | GEO Workspace (frontend + backend) | — |
| **HDZ Team** | HDZ（混洞织）产品线 | — |
| **Community Team** | 社区模块 | — |
| **Knowledge Infra** | Citation/Evidence/Claim/Trust Engine | P2 阶段负责人 |
| **Architecture Committee** | SST + ADR + 架构合规 | 最终仲裁 |

---

> **文档历史**
> | 版本 | 日期 | 变更 |
> |------|------|------|
> | v1.0 | 2026-07-19 | 初次建立 — 基于 V4.1 审计扫描 |
