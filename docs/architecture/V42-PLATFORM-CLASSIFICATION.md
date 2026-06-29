# V4.2 Platform Classification（平台分类档案）

> 版本：V4.2
> 日期：2026-07-19
> 前置：A1 Dependency Discovery ✅ | A2 Classification Plan ✅
> 关联：SST（SYSTEM-STRUCTURE-TREE-v1.md）、PCD（PLATFORM-CONVERGENCE-DECISION.md）

---

V4.2 平台收敛的最终分类成果。每个模块从六级生命周期模型中唯一归属：

```
PLANNED
  ↓
KEEP（Active Development）
  ↓
FREEZE（Feature Complete）
  ↓
MAINTAIN（Compatibility Only）
  ↓
DEPRECATE（Exit Process）
  ↓
REMOVE
```

| 级别 | 代码 | 含义 | 允许的动作 |
|------|------|------|-----------|
| 📋 PLANNED | 规划中 | 确认需要但尚未开发 | 设计、调研 |
| ✅ KEEP | 活跃开发 | 长期保留，持续演进 | 新功能、修复、重构 |
| ❄️ FREEZE | 冻结 | 功能完整，不做结构性变更 | Bugfix 兼容性修复 |
| 🛠️ MAINTAIN | 仅维护 | 兼容性维护，无新功能 | Bugfix 不扩功能 |
| ⏸️ DEPRECATE | 废弃中 | 业务废弃，切断入口，逐步下线 | 仅 Exit Process |
| ❌ REMOVE | 已删除 | 安全删除 | 可追溯，不回滚 |

这一模型覆盖了模块从规划到删除的完整生命周期。每个模块都能明确知道自己当前所处的阶段，不再出现"这是废弃模块还是基础设施？"的判断分歧。

---

## Workspace（业务层）

### 工作台

| 模块 | 分类 | 所属 | 完成度 | 备注 |
|------|------|------|--------|------|
| GEO 工作台 | ✅ KEEP | Workspace | 86% | Reference Workspace |
| 短剧工作台 | ✅ KEEP | Workspace | 78% | 核心产品 |
| 小说工作台 | ✅ KEEP | Workspace | 70% | 核心产品 |
| PPT 工作台 | ✅ KEEP | Workspace | 68% | 核心产品 |
| 音乐创作 | ✅ KEEP | Workspace | 13% | 独立产品线，需提升 |
| 社区 | ✅ KEEP | Workspace | — | 平台附属功能 |

### 工作台相关后端服务

| 模块 | 分类 | 路径 | 备注 |
|------|------|------|------|
| GEO 后端服务 | ✅ KEEP | `backend/src/services/geo/` | 活跃，独立于前端模块 |
| HDZ（混沌珠） | ✅ KEEP | `backend/src/routes/hdz/` | 独立产品线，活跃 |
| Desktop | ✅ KEEP | `backend/src/routes/desktop-*` | 桌面端路由，活跃 |

---

## Platform（平台层）

### Core 核心能力

| 模块 | 分类 | 路径 | 备注 |
|------|------|------|------|
| Provider Runtime | ❄️ FREEZE | `core/runtime/` | V1 RC 已冻结 |
| Agent Graph | ✅ KEEP | `core/agent-graph/` | 活跃开发 |
| Asset Economy | ✅ KEEP | `core/asset-economy/` | 活跃开发 |
| Citation | ✅ KEEP | `core/citation/` | P2.1 已完成 |
| Governance | ✅ KEEP | `core/governance/` | 活跃开发 |
| Control Plane | ✅ KEEP | `core/control-plane/` | 活跃开发 |
| Policy Adapter | ✅ KEEP | `core/policy-adapter/` | 活跃开发 |
| Policy Signal | ✅ KEEP | `core/policy-signal/` | 活跃开发 |
| Stream Plane | ✅ KEEP | `core/stream-plane/` | 活跃开发 |
| Cluster | ✅ KEEP | `core/cluster/` | 基础设施 |
| Global | ✅ KEEP | `core/global/` | 全局配置 |
| constraint-physics | ❌ REMOVE | `core/constraint-physics/` | 已删除（零引用孤岛） |
| style-evolution | ❌ REMOVE | `core/style-evolution/` | 已删除（零引用孤岛） |

### Runtime（PLAT 系列）

| 模块 | 分类 | 路径 | 备注 |
|------|------|------|------|
| Execution Engine | ❄️ FREEZE | `services/platform/execution/` | V4.1 冻结 |
| Capability Platform | ❄️ FREEZE | `services/platform/capability/` | V4.1 冻结 |
| Resource Runtime | ❄️ FREEZE | `services/platform/resource/` | V4.1 冻结 |
| Workspace Runtime | ❄️ FREEZE | `services/platform/workspace/` | V4.1 冻结 |
| Agent Runtime | ❄️ FREEZE | `services/platform/agent/` | V4.1 冻结 |
| Workflow Runtime | ❄️ FREEZE | `services/platform/workflow/` | V4.1 冻结 |
| Governance (PLAT) | ❄️ FREEZE | `services/platform/governance/` | V4.1 冻结 |
| Phase I Runtime | ❄️ FREEZE | `backend/src/runtime/` | 133 文件，待引用点迁移后正式冻结 |

### Infrastructure

| 模块 | 分类 | 路径 | 备注 |
|------|------|------|------|
| **盘古斧系统 (Pangu)** | 🛠️ MAINTAIN | `backend/src/`（32 引用） | **内部工具链，非业务系统** |
| EventBus | 🛠️ MAINTAIN | `packages/studio-platform/src/event/` | 当前 stub，评估后升级 |
| State Runtime | 🛠️ MAINTAIN | `packages/studio-platform/src/state/` | 当前 stub，评估后升级 |
| Queue / Worker | ✅ KEEP | `backend/src/queue/` | 活跃开发 |
| Health | ✅ KEEP | `backend/src/health/` | 活跃开发 |
| Gateway | 🛠️ MAINTAIN | `backend/src/gateway/` | 含 SSE 等 |

---

## Admin（统一后台）

| 模块 | 分类 | 路径 | 备注 |
|------|------|------|------|
| Director OS | ✅ KEEP | `pages/director-os/`（35 页面） | 新统一后台 |
| 旧 Admin (aigc) | ⏸️ DEPRECATE | `pages/admin/aigc/`（18 页面） | 待迁移到 Director OS |
| GEO 管理入口 | 📋 Planned | — | 暂缺失，待 Admin MVP |

---

## kmki-ui

| 模块 | 分类 | 路径 | 备注 |
|------|------|------|------|
| kmki-ui 组件库 | 📋 Planned | `frontend/components/kmki-ui/` | 0 组件 → 5 首批（P0） |

---

## 实验 / 历史代码

| 模块 | 分类 | 路径 | 备注 |
|------|------|------|------|
| 生活助手 | ⏸️ DEPRECATE | 4 API + 9 页面 + 3 表 | **业务废弃**，Phase A3 Batch 2 已完成：入口隐藏 + Feature Flag + 后端标记 |
| P18 实验 | ⏸️ DEPRECATE | 9 后端文件 + 4 表 | 停止新功能 |
| p0-gateway 子系统 | ⏸️ DEPRECATE | 15 文件 + 前端 | 停止新功能 |
| V3 遗留表 | ⏸️ DEPRECATE | V3RenderResult, ReplayFrame, NarrativeV3Metrics | 随 P18 一起 |
| 前端 modules/geo/ | ❌ REMOVE | 13 文件 | 已删除（零引用） |
| 前端 brand-geo/ | ❌ REMOVE | — | 已删除（有替代路径） |
| .bak 文件 | ❌ REMOVE | 8 个 | 已删除 |
| schema.prisma.bak.phasex | ❌ REMOVE | 1 个 | 已删除 |

---

## 汇总

| 分类 | 计数 | 包含 |
|------|------|------|
| ✅ KEEP | 18 | GEO/短剧/小说/PPT/音乐/社区 + Core 能力 + 基础设施 |
| ❄️ FREEZE | 9 | PLAT-006~012 + Provider Runtime + Phase I Runtime |
| 🛠️ MAINTAIN | 4 | 盘古斧 + EventBus stub + State stub + Gateway |
| ⏸️ DEPRECATE | 4 | 生活助手 + P18 + p0-gateway + V3 遗留 |
| ❌ REMOVE | 6 | constraint-physics + style-evolution + 前端 geo + brand-geo + .bak + prisma backup |
| 📋 Planned | 2 | kmki-ui + GEO Admin 入口 |

---

## 执行路线（V4.2 Phase A）

| 批次 | 焦点 | 模块 | 状态 |
|------|------|------|------|
| **Batch 1** | 安全删除（零引用孤岛） | constraint-physics, style-evolution, .bak 文件 | ✅ **已关闭** |
| **Batch 2** | 业务退出 | 生活助手 (WebSocket/API/页面) | ✅ **已关闭** |
| **Batch 2.1** | Access Lock | 前端 modules/geo, brand-geo | ✅ **已关闭** |
| **Batch 3** | P18 收敛 | P18 实验（9 后端文件 + 4 表） | ⏳ **当前** |
| **Batch 4** | V3 + 数据库收敛 | V3 遗留表 + DB Schema Guard | 📋 待 Batch 3 Gate |
| **Batch 5** | p0-gateway 退役（独立批次） | p0-gateway 子系统（15 文件 + 前端） | 📋 待 Batch 4 Gate |
| **Phase A Exit** | 收敛完成审计 | 全平台 | 📋 |

> **原则**: 每个 Batch 聚焦一种类型的收敛。执行 → Audit → Gate 验收后再进入下一批。

---

## Phase B（Platform Foundation）

Phase A 全部关闭后启动。排序：

| 优先级 | 能力 | 类型 | 说明 |
|--------|------|------|------|
| **1** | **AI Center** | Platform AI Control Plane | Provider / Credential / 默认模型 / 连接 / 路由 |
| **2** | kmki-ui | 统一组件库 | UserCard / MembershipCard / ModelCard / SidebarFooter |
| **3** | Unified Admin | 后台统一 | Director OS 补齐 |
| **4** | Asset Center | 资产中心 | Asset Economy UI |
| **5** | Knowledge Infra | 知识智能 | Citation → Evidence → Claim → Trust |

> **平台设计原则**: "工作台负责生产 AI，AI Center 负责管理 AI。"  
> Workspace 不管理 API Key / Provider / Model。这些全部归属 Platform AI Center。

---

## 使用规则

1. 所有模块的最终分类以本文档为准
2. KEEP 模块可以正常开发
3. FREEZE 模块的变更需要 Architecture Review 决议
4. MAINTAIN 模块仅修复兼容性问题
5. DEPRECATE 模块遵循"先切断入口，再确认无人调用，最后删除"流程
6. 新增模块必须先确定分类再开发

---

*End of V4.2 Platform Classification*
