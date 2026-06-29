# V4.1 Platform Inventory（PI）— 平台资产清单

> 版本：V4.1
> 日期：2026-07-19
> 状态：✅ 已冻结
> 审计依据：KMKI-PLATFORM-AUDIT-V41.md

---

PI 是六份架构真相源中最具工程实操性的文档。它记录的是平台的**真实资产现状**，不是设计目标。

**作用：**
- 开发前查 PI → 已有组件不复用 = 违规
- 新增组件/API/表 → 必须更新 PI
- 架构漂移检查 → PI 作为对比基准

---

## 1. Workspace Inventory

| # | 工作台 | 目录 | 完成度 | Owner | 页面数 | 组件数 | API 路由数 | 状态 |
|---|--------|------|--------|-------|--------|--------|-----------|------|
| 1 | GEO (品牌地理) — Old | `studio-v2/workspace/brand-geo/` | 86% (待评估新路径) | GEO | 13 | 52 | 17+ | ⏸️ Deprecate（计划迁移到 workspace/geo/） |
| 2 | GEO (品牌地理) — New | `workspace/geo/` | — | GEO | — | — | — | ✅ Active（迁移目标） |
| 2 | 短剧 | `studio-v2/workspace/director*/` | 78% | Director | 8+ | 20+ | 20+ | ⚠️ 发展中 |
| 3 | 小说 | `studio-v2/workspace/novel/`, `pages/novel/` | 70% | Novel | 2 | — | 5+ | ⚠️ Legacy |
| 4 | PPT | `studio-v2/workspace/ppt/` | 68% | PPT | — | — | — | ⚠️ 发展中 |
| 5 | 音乐创作 | `studio-v2/workspace/music-generation/` | 13% | Music | 1 | 1 | — | ❌ 未完成 |
| 6 | 社区 | `pages/community/`, `services/community/` | — | Platform | 3 | 2 | 2+ | ⚠️ 基础 |

### Workspace Inventory 说明

- **完成度** 基于审计 6 维度评分（Adapter/Runtime/Repository/UI/独立性/API）
- **Owner** 在未来 MOM 中定义角色
- 新增工作台必须先登记到本表

---

## 2. Core Inventory

| # | 能力 | 归属 | 状态 | 消费方 | 是否允许扩展 | 文件数 |
|---|------|------|------|--------|------------|--------|
| 1 | Provider Runtime | `core/runtime/` | ✅ Stable | 全工作台 | ❌ 冻结 | — |
| 2 | Execution Engine | `services/platform/execution/` | ✅ Stable | 全工作台 | ❌ 冻结 | 4 路由 |
| 3 | Capability Platform | `services/platform/capability/` | ✅ Stable | 全工作台 | ❌ 冻结 | 6 路由 |
| 4 | Resource Runtime | `services/platform/resource/` | ✅ Stable | 全工作台 | ❌ 冻结 | 8 路由 |
| 5 | Workspace Runtime | `services/platform/workspace/` | ✅ Stable | 全工作台 | ❌ 冻结 | 8 路由 |
| 6 | Agent Runtime | `services/platform/agent/` | ✅ Stable | 全工作台 | ❌ 冻结 | 6 路由 |
| 7 | Workflow Runtime | `services/platform/workflow/` | ✅ Stable | 全工作台 | ❌ 冻结 | 7 路由 |
| 8 | Governance | `services/platform/governance/` | ✅ Stable | 全工作台 | ✅ 可扩展 | 12 路由 |
| 9 | SDK | `packages/studio-platform/` | ✅ Stable | 全工作台 | ✅ 可扩展 | 12 模块 |
| 10 | Citation | `core/citation/` | ✅ P2.1 | GEO（首个） | ✅ 可扩展 | 11 文件 |
| 11 | Evidence | `core/evidence/` | 📋 Planned | GEO, 小说 | ✅ 可扩展 | — |
| 12 | Claim | `core/claim/` | 📋 Planned | GEO, 小说 | ✅ 可扩展 | — |
| 13 | Trust Engine | `core/trust/` | 📋 Planned | 全工作台 | ✅ 可扩展 | — |
| 14 | Agent Graph | `core/agent-graph/` | ✅ Active | 全工作台 | ✅ 可扩展 | — |
| 15 | Asset Economy | `core/asset-economy/` | ✅ Active | 全工作台 | ✅ 可扩展 | — |
| 16 | EventBus | `packages/studio-platform/src/event/` | ❌ Stub | 全工作台 | ❌ 需重写 | 1 文件 |
| 17 | State Runtime | `packages/studio-platform/src/state/` | ❌ Stub | 全工作台 | ❌ 需重写 | 1 文件 |
| 18 | Asset Center | `services/asset/` | ⚠️ Active | 全工作台 | ✅ 可扩展 | 12 |
| 19 | 语义引擎 | `services/semantic/` | ⚠️ Active | 短剧/GEO | ✅ 可扩展 | 17 |
| 20 | 音频运行时 | `services/audio-runtime/` | ⚠️ Active | 短剧/音乐 | ✅ 可扩展 | 13 |

### Core Inventory 说明

- **状态定义**：Stable（冻结）> Active（活跃开发）> Planned（规划中）> Stub（占位）
- **消费方**：当前使用此能力的模块
- 新增能力必须先登记再开发。已稳定能力只允许扩展（Extension Point），不允许修改核心路径。

---

## 3. Database Inventory

### 3.1 保留表

| 业务域 | 表数 | 主要模型 | 状态 |
|--------|------|---------|------|
| Asset | 15+ | Asset, AssetVersion, UnifiedAsset | ✅ 保留，需合并 |
| Knowledge | 10+ | KnowledgeObject, Citation, Evidence, Claim | ✅ 保留 |
| GEO | 25+ | GEOProject, GEOCitation, GEOClaim | ✅ 保留 |
| Execution/Runtime | 20+ | Execution, WorkspaceExecution, TaskExecution | ✅ 保留 |
| Agent | 20+ | AgentDef, AgentDefinition | ⚠️ 需合并 |
| Workflow | 15+ | WorkflowDef, WorkflowInstance, WorkflowNode | ✅ 保留 |
| Governance | 15+ | Policy, Role, Tenant, Quota, License | ✅ 保留 |
| HDZ | 15+ | HdzProject, HdzChapter | ⚠️ 独立产品线 |
| Payment/Billing | 10+ | PaymentOrder, BillingRecord | ✅ 保留 |
| User/Membership | 10+ | User, Membership, MemberPlan | ✅ 保留 |
| Community | 5+ | CommunityPost, Comment | ✅ 保留 |

### 3.2 待合并表

| 表 1 | 表 2 | 决策 |
|------|------|------|
| `GeoProject` | `GEOProject` | 🔄 合并 |
| `Asset` | `UnifiedAsset` | 🔄 合并到 UnifiedAsset |
| `AgentDef` | `AgentDefinition` | 🔄 合并 |

### 3.3 删除候选表

| 表 | 原因 |
|-----|------|
| `V3RenderResult` | V3 遗留 |
| `public_V3RenderResult` | V3 遗留 |
| `P18Pair` / `p18_pairs` | P18 实验数据 |
| `ReplayFrame` | V3 遗留 |
| `NarrativeV3Metrics` | V3 遗留 |

### Database Inventory 使用规则

- 新增表必须登记，注明所属业务域
- 合并表前必须先确认所有消费方已迁移
- 删除表前必须确认零引用

---

## 4. API Inventory

### 4.1 按命名空间

| 命名空间 | 路由文件数 | 状态 | 备注 |
|---------|-----------|------|------|
| `/platform/*` | 52 | ✅ 合规 | 7 大模块 |
| `admin-*` | 19 | ⚠️ 前缀不统一 | 待统一为 `/api/admin/` |
| 工作台路由 | 12 | ⚠️ 未统一 | 建议 `/api/workspace/[name]/` |
| 独立产品 | 7 | ❌ 散落 | HDZ / 社区 |
| 通用 | 7 | ✅ | auth, health, upload 等 |
| **总计** | **97** | | |

### 4.2 API 格式合规

| 路由组 | ApiResponse 格式 | 建议 |
|--------|-----------------|------|
| `/platform/*` | ✅ 使用 | 维持 |
| `admin-*` | ⚠️ 部分使用 | 统一到 ApiResponse |
| 工作台路由 | ❌ 未统一 | 新建强制使用 |
| 独立产品 | ❌ 未统一 | 维持现状，不强制 |

### API Inventory 使用规则

- 新增 API 必须登记到本表
- 新路由强制使用 ApiResponse 格式
- Admin 路由最终统一前缀 `/api/admin/`

---

## 5. UI Inventory

### 5.1 kmki-ui 组件库

| 组件名 | 状态 | 优先级 | 备注 |
|--------|------|--------|------|
| **首批（P0）** | | | |
| Button | 📋 待建 | P0 | 基础按钮组件 |
| Card | 📋 待建 | P0 | 卡片容器 |
| StatCard | 📋 待建 | P0 | 统计卡片 |
| EmptyState | 📋 待建 | P0 | 空状态占位 |
| Badge | 📋 待建 | P0 | 徽标 |
| **后续** | | | |
| Panel | 📋 待建 | P1 | 面板容器 |
| Dialog | 📋 待建 | P1 | 弹窗 |
| Table | 📋 待建 | P1 | 数据表格 |
| Wizard | 📋 待建 | P1 | 向导步骤 |
| ... | | | |

### 5.2 现有组件分布

| 组件目录 | 组件数 | 归属 | 建议 |
|---------|--------|------|------|
| `kunlun/` | 20 | 通用 | 逐步迁移到 kmki-ui |
| `r11/` | 6 | R11 控制台 | 保持独立 |
| `director/` | 3 | 短剧 | 部分可复用拎出 |
| `community/` | 2 | 社区 | 保持独立 |
| `business/` | 1 | 业务 | 评估复用 |

### UI Inventory 使用规则

- **组件优先查 PI**，已有组件不复用 = 违规
- 新建组件前先确认 kmki-ui 中是否已存在
- `kunlun/` 的 20 个组件是 kmki-ui 最大的迁移源

---

## PI 维护指南

### 新增前检查

```
📋 要新增工作台？
   → 查 Workspace Inventory：同名工作台是否存在？
   → 如无 → 登记后开发

📋 要新增平台能力？
   → 查 Core Inventory：是否存在类似能力？
   → 如无 → 确定归属（Core/Workspace）→ 登记后开发

📋 要新增数据库表？
   → 查 Database Inventory：是否存在类似表？
   → 检查 @@map 覆盖范围
   → 确认不属于删除候选

📋 要新增 API 接口？
   → 查 API Inventory：已有 API 是否可覆盖？
   → 确定命名空间归属

📋 要新增 UI 组件？
   → 查 UI Inventory：kmki-ui 是否已有？
   → `kunlun/` 是否已有？
   → 确认后：新建 → 同时更新 PI
```

### 更新时机

| 事件 | 动作 |
|------|------|
| 新增工作台 | 更新 Workspace Inventory |
| 新增平台能力 | 更新 Core Inventory |
| 新增/合并/删除表 | 更新 Database Inventory |
| 新增 API | 更新 API Inventory |
| 新增 UI 组件 | 更新 UI Inventory |
| 完成里程碑 | 全量 PI 审计（Architecture Drift Check） |

---

*End of V4.1 Platform Inventory*
