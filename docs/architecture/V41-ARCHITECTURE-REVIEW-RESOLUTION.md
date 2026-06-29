# V4.1 Architecture Review — 正式决议

> 日期：2026-07-19
> 审计依据：KMKI-PLATFORM-AUDIT-V41.md
> 架构真相源：SST / MOM / DR / CR / PCD / PI
> 状态：✅ 已签署

---

V4.1 Architecture Review 共形成四项正式决议。这四项决议是后续所有 Sprint 的执行基础。

---

## 决议 A：Platform Convergence Decision

基于审计数据和 PCD（Platform Convergence Decision）文档，确认以下决策：

### ✅ Keep（长期保留）

| 类别 | 模块 | 说明 |
|------|------|------|
| Workspace | 短剧工作台 | 核心产品，78% 成熟度 |
| Workspace | 小说工作台 | 核心产品，70% 成熟度 |
| Workspace | PPT 工作台 | 核心产品，68% 成熟度 |
| Workspace | GEO 工作台 | Reference Workspace，86% 成熟度 |
| Workspace | 音乐创作 | 独立产品线，13% 成熟度需提升 |
| Workspace | 社区 | 平台附属功能 |
| Platform | Core | 平台核心，92% 成熟度 |
| Platform | Runtime (PLAT-006~012) | 已冻结，95% 成熟度 |
| Platform | Asset Center | 平台基础能力 |
| Platform | Trust Engine | 规划中（P2.4） |
| Platform | License | 已实现 |
| Platform | Admin (Director OS) | 统一后台，35% 成熟度需提升 |
| Platform | SDK (@studio/platform) | 已冻结 |
| Platform | kmki-ui | **优先建设，P0** |
| Platform | Infrastructure | 队列、Worker 等 |

### 🔄 Move（迁移）

| 模块 | 当前路径 | 目标路径 | 说明 |
|------|---------|---------|------|
| frontend/modules/geo/ | `frontend/modules/geo/` | 迁移到 `studio-v2/workspace/brand-geo/` | 已标记 DEPRECATED，内容需整合 |
| Agent 相关代码 | `backend/src/agents/` | 归入 Workspace 或 Core | 当前在顶层目录，归属不清晰 |

### ⏸️ Deprecate（废弃，保留代码不开发）

| 模块 | 路径 | 原因 |
|------|------|------|
| constraint-physics | `core/constraint-physics/` | 复用率未知，未来可能清理 |
| style-evolution | `core/style-evolution/` | 复用率未知，未来可能清理 |
| Phase I Runtime | `backend/src/runtime/` | 已有 PLAT-006~012 完整替代 |
| p0-gateway | `backend/src/routes/p0-gateway-route.ts` | 实验性，未投入生产 |

### ❌ Remove（删除）

| 模块 | 路径 | 确认条件 |
|------|------|---------|
| 生活助手相关 | `backend/src/routes/admin-customer-service.ts` 等 | 依赖分析确认零引用后删除 |
| 盘古斧系统 | 相关遗留代码 | 依赖分析确认零引用后删除 |
| P18 实验 | `backend/src/services/p18/` | 确认无消费方后删除 |
| V3 遗留 | V3RenderResult, ReplayFrame, NarrativeV3Metrics 表 | 确认无引用后删除 |
| .bak 文件 | 8 个遗留 .bak | 确认原始文件正常后删除 |
| DEPRECATED 标记 | `frontend/modules/geo/DEPRECATED.md` 等 | 迁移完成后删除 |

**执行方式：** 先做全平台依赖分析，确认零引用后再执行删除。每个删除项必须有明确的依赖分析记录。

---

## 决议 B：V4.2 Execution Order

基于审计成熟度评分和依赖关系，V4.2 划分为三个连续阶段：

### V4.2A：Platform Convergence（第一优先）

| 任务 | 平台价值 | 用户价值 | 技术风险 | 前置依赖 |
|------|--------:|--------:|--------:|---------:|
| 历史模块清理 | 极高 | 中 | 中 | 审计完成 ✅ |
| 数据库与目录收敛 | 极高 | 中 | 中 | 审计完成 ✅ |
| 删除已确认废弃模块 | 极高 | 低 | 低 | 依赖分析完成 |
| 更新六份架构真相源 | 极高 | 低 | 低 | 清理完成后 |

**目标：** 平台代码瘦身，消除冗余和孤岛模块。

### Phase A 约束：收敛，不扩展

本阶段严格遵守 **"收敛，不扩展"** 原则。

#### ✅ 允许事项

- 清理已确认废弃模块（在确认无依赖后）
- 删除 `.bak`、历史备份、孤立目录和零引用代码
- 清理无引用 API、路由、配置
- 清理确认废弃且无依赖的数据库表、索引和迁移
- 收敛菜单、权限、后台入口，使其与最终保留的六个工作台一致
- 更新六份架构真相源，使其与实际代码保持一致

#### ❌ 本阶段不执行

- ❌ 新增平台能力
- ❌ 新增工作台功能
- ❌ 重构 Runtime
- ❌ 调整 Citation / Evidence / Trust 架构
- ❌ 开始 kmki-ui 大规模建设
- ❌ 开始统一 Admin 功能开发

### Convergence Exit Gate

只有满足以下所有条件，才能宣布 Phase A 完成：

| # | 验收项 | 要求 |
|---|--------|------|
| 1 | 保留工作台与代码一致 | ✅ 六个工作台确认保留 |
| 2 | 废弃模块已移除或完成迁移标记 | ✅ |
| 3 | 无遗留 .bak、实验目录、孤立代码 | ✅ |
| 4 | 数据库删除项完成依赖确认 | ✅ |
| 5 | API 与路由完成收敛 | ✅ |
| 6 | 六份架构真相源已同步更新 | ✅ |
| 7 | 编译、测试、构建通过 | ✅ |

### V4.2B：Platform Foundation（第二优先）

| 任务 | 平台价值 | 用户价值 | 技术风险 | 前置依赖 |
|------|--------:|--------:|--------:|---------:|
| kmki-ui MVP | 极高 | 高 | 低 | 收敛完成 |
| 统一 Admin MVP | 高 | 高 | 中 | 收敛完成 |
| License / Asset Center 后台入口 | 高 | 高 | 中 | Admin 稳定 |

**目标：** 平台能力前端化，所有工作台共享 UI 底座。

### V4.2C：Knowledge Infrastructure（第三优先）

| 任务 | 平台价值 | 用户价值 | 技术风险 | 前置依赖 |
|------|--------:|--------:|--------:|---------:|
| P2.2 Evidence Foundation | 高 | 中 | 低 | Citation 完成 ✅ |
| P2.3 Claim Engine | 高 | 中 | 中 | Evidence |
| P2.4 Trust Engine | 极高 | 高 | 中 | Claim |

**目标：** 在收敛且稳定的平台基础上完成 Knowledge Infrastructure 全链路。

### 为什么 Convergence 先于 Evidence

1. **减少技术债**：历史模块越早清理，维护成本越低
2. **稳定平台基础**：kmki-ui 和 Admin 是跨工作台复用能力，越早完成收益越大
3. **避免重复返工**：Evidence/Claim/Trust 涉及前端、后台、权限、资产等模块，平台能力不稳定就开发会导致返工

**执行顺序不临时调整。** 一个阶段完成后才进入下一阶段。

---

## 决议 C：Platform Baseline Freeze

### 六份架构真相源

确认以下六份文档为昆仑镜平台的**唯一架构依据**：

| 文档 | 版本 | 文件 |
|------|------|------|
| SST (System Structure Tree) | v1 | `SYSTEM-STRUCTURE-TREE-v1.md` |
| MOM (Module Ownership Map) | v1 | `V41-MODULE-OWNERSHIP-MAP.md` |
| DR (Dependency Rules) | v1 | `V41-DEPENDENCY-RULES.md` |
| CR (Capability Registry) | v1 | `V41-CAPABILITY-REGISTRY.md` |
| PCD (Platform Convergence Decision) | v1 | `V41-PLATFORM-CONVERGENCE-DECISION.md` |
| PI (Platform Inventory) | v1 | `V41-PLATFORM-INVENTORY.md` |

### 强制规则

从此刻起，严格执行：

> **任何提交，如果涉及新增目录、平台能力、数据库表、API 或后台菜单，但没有同步更新对应的架构真相源，不得合并。**

对应关系：

| 变更内容 | 必须更新的真相源 |
|---------|----------------|
| 新增/删除模块或目录 | SST + MOM |
| 新增平台能力 | CR |
| 新增/修改依赖方向 | DR |
| 新增/删除模块（平台收敛） | PCD |
| 新增工作台 | SST + MOM + PI (Workspace) |
| 新增数据库表 | PI (Database) |
| 新增 API 接口 | PI (API) |
| 新增 UI 组件 | PI (UI) |
| 新增后台菜单 | PI (API) + PCD |

---

## 决议 D：Architecture Governance Charter

从 V4.1 开始，所有开发强制遵循以下治理流程：

```
需求提出
  ↓
查询架构真相源
  ├── SST → 系统结构（放哪一层？）
  ├── CR  → 能力注册（已有能力不复用？违规）
  ├── PI  → 资产清单（已有组件/API/表？）
  ├── MOM → 模块归属（谁负责？）
  ├── DR  → 依赖规则（允许依赖吗？）
  └── PCD → 收敛决策（应该保留吗？）
  ↓
确定模块归属（Workspace / Core / Admin）
  ↓
SDP Sprint Delivery（Phase 0 → Phase 11）
  ↓
验收（用户确认）
  ↓
更新六份架构真相源（硬性：不更新不合并）
  ↓
Freeze Tag
```

### 三级审计机制

| 层级 | 周期 | 执行 | 输出 |
|------|------|------|------|
| **Sprint 审计** | 每个 Sprint | OpenClaw 自审 + 用户验收 | SDP Checklist 验证 |
| **版本审计** | 每大版本 | 全平台 Architecture Audit | 更新六份架构真相源 |
| **收敛审计** | 每正式版本 | Platform Convergence Review | 重新评估保留/迁移/删除策略 |

### 架构漂移容忍度

| 级别 | 定义 | 容忍时间 | 负责人 |
|------|------|---------|--------|
| P0 | 违反 DR（依赖规则） | 立即修复 | OpenClaw |
| P1 | 未登记能力/组件 | 下一 Sprint | OpenClaw |
| P2 | 真相源部分过期 | 两个 Sprint 内 | OpenClaw |

---

## 签署确认

> 本人确认 V4.1 Architecture Review 的四项正式决议，并授权 OpenClaw 按 V4.2 Execution Order 推进后续 Sprint。

签署人：____________
日期：____________

---

*V4.1 Architecture Review — 平台治理驱动开发，正式开始。*
