# V4.1 Architecture Freeze — 架构定版（平台元年）

> 版本：V4.1
> 日期：2026-07-19
> 状态：✅ **审计完成，定版就绪**
> 前置条件：V4 Platform Baseline ✅ 已冻结

---

## 里程碑宣言：昆仑镜平台元年

V4.1 是昆仑镜从 **Feature Driven（功能驱动）** 转向 **Architecture Driven（架构驱动）** 的分界点。

到 V4.1 为止，昆仑镜已具备平台化开发的全部基础条件：

| # | 能力 | 对应文档 | 状态 |
|---|------|---------|------|
| 1 | ✅ 架构统一基线 | Platform Baseline (V4) | 已冻结 |
| 2 | ✅ 开发统一流程 | SDP (Sprint Delivery Protocol) | 已建立 |
| 3 | ✅ 系统统一结构 | SST | ✅ 已冻结 |
| 4 | ✅ 模块统一归属 | MOM | ✅ 已冻结 |
| 5 | ✅ 依赖统一规则 | DR | ✅ 已冻结 |
| 6 | ✅ 能力统一注册 | CR | ✅ 已冻结 |
| 7 | ✅ 平台统一收敛决策 | PCD | ✅ 已冻结 |
| 8 | ✅ 平台统一资产清单 | PI | ✅ 已冻结 |

**从此以后：开发不凭经验，不凭目录，不凭历史代码。凭架构真相源。**

---

## 六份架构真相源

V4.1 冻结以下六份文档，作为昆仑镜平台的永久架构基线。

| # | 文档 | 回答的问题 | 文件 |
|---|------|-----------|------|
| 1 | **SST** (System Structure Tree) | 系统由哪些部分组成？ | `SYSTEM-STRUCTURE-TREE-v1.md` |
| 2 | **MOM** (Module Ownership Map) | 每个模块谁负责、属于哪层、依赖谁？ | `V41-MODULE-OWNERSHIP-MAP.md` |
| 3 | **DR** (Dependency Rules) | 允许什么依赖？禁止什么依赖？ | `V41-DEPENDENCY-RULES.md` |
| 4 | **CR** (Capability Registry) | 平台已有能力？新增应复用还是新建？ | `V41-CAPABILITY-REGISTRY.md` |
| 5 | **PCD** (Platform Convergence Decision) | 保留/迁移/废弃/删除哪些模块？ | `V41-PLATFORM-CONVERGENCE-DECISION.md` |
| 6 | **PI** (Platform Inventory) | 平台有哪些资产？（工作台/数据库/API/UI） | `V41-PLATFORM-INVENTORY.md` |

---

## V4.1 Architecture Review 五阶段议程

### 第一阶段：Reality — 平台真实现状

只依据审计结果，不依据历史设计。逐项确认：

| 检查项 | 数据来源 | 输出 |
|--------|---------|------|
| 前端真实结构 | Frontend Audit | 工作台数量、组件统计、超限清单 |
| 后端真实结构 | Backend Audit | 目录大小、模块重复、Dead Code |
| 数据库真实结构 | Database Audit | 表数量、历史遗留、零引用 |
| Admin 真实结构 | Admin Audit | 后台完成度、缺失功能 |
| Core 能力真实结构 | Core Platform Audit | 真平台能力 vs 工作台代码 |
| 六个保留工作台 | Workspace Audit | 短剧/小说/PPT/GEO/音乐/社区 |
| 历史遗留模块 | Technical Debt Audit | 删除候选列表 |

**输出**：当前平台成熟度 + P0/P1 风险 + 技术债清单

### 第二阶段：Truth — 冻结架构真相源

逐份确认并冻结：

| # | 文档 | 检查要点 | 冻结条件 |
|---|------|---------|---------|
| 1 | SST | 节点覆盖完整代码库 | 与实际目录一致 |
| 2 | MOM | 模块归属无争议 | 所有 Core 模块不含 Workspace 依赖 |
| 3 | DR | 禁止的依赖方向 | 无违反案例 |
| 4 | CR | 平台能力已登记 | 无未登记能力 |
| 5 | PCD | 每项决策有依据 | Keep/Move/Deprecate/Remove 全部确认 |
| 6 | PI | 资产清单完整 | 覆盖 Workspace/DB/API/UI 四个维度 |

**以后所有架构调整必须先修改这六份文档，再修改代码。**

### 第三阶段：Convergence — 平台收敛

这一步**不是开发**，而是平台治理。

#### 保留 Workspace

| 工作台 | 决策 | 说明 |
|--------|------|------|
| 短剧 | ✅ Keep | 核心产品 |
| 小说 | ✅ Keep | 核心产品 |
| PPT | ✅ Keep | 核心产品 |
| GEO | ✅ Keep | Reference Workspace |
| 音乐创作 | ✅ Keep | 独立产品线 |
| 社区 | ✅ Keep | 平台附属功能 |

#### 保留 Platform

| 模块 | 决策 | 说明 |
|------|------|------|
| Core | ✅ Keep | 平台核心 |
| Runtime | ✅ Keep | 已冻结 |
| Asset Center | ✅ Keep | 平台基础能力 |
| Trust Engine | ✅ Keep | 规划中 |
| License | ✅ Keep | 已实现 |
| Admin | ✅ Keep | Director OS |
| kmki-ui | ✅ Keep | 首批组件待建设 |
| SDK | ✅ Keep | @studio/platform |
| Infrastructure | ✅ Keep | 队列/Worker |

#### 删除候选

以下模块需先做依赖分析再行清理：

| 模块 | 路径 | 预计决策 |
|------|------|---------|
| 生活助手 | `backend/src/routes/admin-customer-service.ts` 等 | ❌ Remove |
| 盘古斧系统 | 相关遗留代码 | ❌ Remove |
| P18 实验 | `backend/src/services/p18/` | ❌ Remove |
| V3 遗留 | `V3RenderResult`, `ReplayFrame` 等 | ❌ Remove |
| p0-gateway | `backend/src/routes/p0-gateway-route.ts` | ❌ Remove |
| DEPRECATED 标记 | `frontend/modules/geo/` | 🔄 迁移 |
| .bak 文件 | 8 个遗留文件 | ❌ 删除 |

**注意：所有删除操作必须先做依赖分析，确认无引用后再执行。**

### 第四阶段：Roadmap Review — 重新排序 Sprint

根据审计结果建立评分矩阵，由数据决定顺序：

| 候选任务 | 业务价值 | 平台价值 | 风险 | 依赖 | 综合优先级 |
|----------|--------:|--------:|-----:|-----:|---------:|
| P2.2 Evidence | | | | | |
| kmki-ui MVP | | | | | |
| Admin MVP | | | | | |
| 数据库收敛 | | | | | |
| 历史模块清理 | | | | | |
| 超限页面拆分 | | | | | |
| TSC 编译修复 | | | | | |

**最终顺序由实际情况决定，不是由计划决定。**

### 第五阶段：Freeze — V4.1 冻结

一次性冻结以下内容：

| 冻结项 | 说明 |
|--------|------|
| **V4.1 Architecture Baseline** | 基于审计验证的平台基线 |
| **System Structure Tree v1** | 唯一架构蓝图 |
| **Platform Convergence Baseline** | 保留/迁移/废弃/删除决策 |
| **Six Source of Truth Documents** | SST / MOM / DR / CR / PCD / PI |
| **Sprint Roadmap (Updated)** | 优先级重排序后的路线图 |

**冻结后所有开发流程：**

```
需求提出
    │
    ▼
查询 SST（系统结构树）
    │
    ▼
查询 CR（能力注册表）— 已有能力不复用 = 违规
    │
    ▼
查 PI（资产清单）— 已有组件不复用 = 违规
    │
    ▼
确定模块归属（Core / Workspace / Admin）
    │
    ▼
Architecture Review（涉及新增能力时必须）
    │
    ▼
更新六份真相源（新增前先更新文档）
    │
    ▼
OpenClaw 按 SDP 开发（Phase 0-11）
    │
    ▼
验收（用户确认）
    │
    ▼
更新六份真相源（开发完成后确认文档同步）
    │
    ▼
Freeze Tag
```

---

## 硬性规则：变更必须同步更新架构真相源

V4.1 强制：**任何提交（PR 或 OpenClaw 提交）如果涉及以下变更但没有同步更新对应的架构真相源，不得合并。**

| 变更内容 | 必须更新的真相源 | 说明 |
|---------|----------------|------|
| 新增/删除模块或目录 | **SST + MOM** | 系统结构和模块归属同步更新 |
| 新增平台能力 | **CR** | 能力注册表是"有没有"的唯一答案 |
| 新增/修改依赖方向 | **DR** | 依赖规则违反即拒绝 |
| 新增/删除模块（平台收敛） | **PCD** | Keep/Move/Deprecate/Remove 决策 |
| 新增工作台 | **SST + MOM + PI**（Workspace） | 三层同步 |
| 新增数据库表 | **PI**（Database） | 必须有业务域归属 |
| 新增 API 接口 | **PI**（API） | 命名空间和路由归位 |
| 新增 UI 组件 | **PI**（UI） | 查已有组件，无重复再创建 |
| 新增后台菜单 | **PI**（API）+ **PCD** | Admin 统一管理 |

**这条规则使文档永远与代码同步。** 不是"开发完再补文档"，而是"文档不更新，代码不让合"。

---

## 新增模块/能力的强制检查清单

任何新增目录、模块、数据库表、API、后台菜单或工作台能力，开发前必须先回答以下 8 个问题：

| # | 问题 | 说明 |
|---|------|------|
| 1 | 属于 Workspace 还是 Core？ | 平台能力放 Core，业务逻辑放 Workspace |
| 2 | 新增能力还是复用已有能力？ | 查 CR，已有能力不得重复实现 |
| 3 | 是否需要新增数据库表？ | 评估是否可复用已有表的 metadata 或扩展字段 |
| 4 | 是否需要新增 API？ | 判断是否存在已有 API 可覆盖 |
| 5 | 是否需要新增后台菜单？ | Admin 统一管理，非工作台私有 |
| 6 | 是否需要新增 kmki-ui 组件？ | 查 PI，已有组件不得重复创建 |
| 7 | 是否影响其他工作台？ | 涉及 core/ 的改动需要评估四个工作台的影响 |
| 8 | 是否违反 SST 结构？ | 违反即拒绝，必须先更新 SST |

---

## Architecture Drift Check（架构漂移检查）

每完成一个较大的里程碑（P2、P3 或新增工作台），执行一次架构漂移检查。

### 检查内容

| # | 检查项 | 如何发现 |
|---|--------|---------|
| 1 | SST 与实际代码是否一致？ | 对比 SST 节点与文件系统目录 |
| 2 | 是否新增未登记目录/模块？ | `find . -type d | sort` 对比 |
| 3 | 是否新增未登记数据库表？ | 对比 Prisma 模型与 Capability Registry |
| 4 | 是否新增未登记 API？ | API Route 扫描 vs API 结构树 |
| 5 | 是否出现跨层依赖？ | 检查 import 路径是否违反 DR |
| 6 | 是否出现重复实现？ | 关键词搜索（如 "citation" 出现在 >1 目录） |
| 7 | 是否新增平台能力却未登记？ | 查 CR 中是否遗漏 |
| 8 | 新增组件是否已存在于 PI？ | 查 PI 避免重复创建 |

### 发现漂移后的处理流程

```
发现漂移
    │
    ▼
标记为技术债（Architecture Drift）
    │
    ▼
评估影响程度（P0/P1/P2）
    │
    ▼
P0/P1 → 当前 Sprint 修复
P2 → 排入下一 Sprint
    │
    ▼
修正 SST / MOM / CR / PI
    │
    ▼
修正代码
```

### 漂移容忍度

| 级别 | 容忍时间 | 负责人 |
|------|---------|--------|
| P0（违反 DR） | 立即修复 | OpenClaw |
| P1（未登记能力/组件） | 下一 Sprint | OpenClaw |
| P2（真相源部分过期） | 两个 Sprint 内 | OpenClaw |

---

## V4.1 交付物依赖关系

```
审计数据（14 章大报告 + 成熟度评分表）
    │
    ├──► SST（系统结构树）
    ├──► MOM（模块归属）—— 基于审计数据
    ├──► DR（依赖规则）—— 基于审计中发现的违规
    ├──► CR（能力注册）—— 基于审计中确认的能力
    ├──► PCD（收敛决策）—— 基于审计中的技术债发现
    └──► PI（平台资产清单）—— 基于审计中的工程现状
```

---

## 完整文件索引

```
docs/
├── architecture/                          ← 架构真相源（6份永久基线）
│   ├── SYSTEM-STRUCTURE-TREE-v1.md         ← SST：唯一架构蓝图（574行）
│   ├── V41-MODULE-OWNERSHIP-MAP.md         ← MOM：模块归属与负责人（97行）
│   ├── V41-DEPENDENCY-RULES.md             ← DR：依赖约束规则（121行）
│   ├── V41-CAPABILITY-REGISTRY.md          ← CR：平台能力注册表（145行）
│   ├── V41-PLATFORM-CONVERGENCE-DECISION.md ← PCD：逐模块收敛决策（236行）
│   ├── V41-PLATFORM-INVENTORY.md           ← PI：平台资产清单（新建）
│   └── V41-ARCHITECTURE-FREEZE.md          ← 本文：流程定义（定版）
│
└── reviews/
    └── PLATFORM-AUDIT-V41/
        ├── INDEX.md                        ← 目录+成熟度评分+Top10（99行）
        └── KMKI-PLATFORM-AUDIT-V41.md      ← 14章全平台审计大报告（358行）
```

---

# 昆仑镜 V4.1 — 平台元年，正式开始。

---

## V4.1 的三层架构总览

V4.1 不是一个普通的版本节点，而是昆仑镜研发体系的一次**工程化转折点**——从功能驱动到架构驱动。

### 第一层：平台架构已稳定

```
Workspace（业务层）
├── 短剧工作台
├── 小说工作台
├── PPT 工作台
├── GEO 工作台          ← Reference Workspace (86%)
├── 音乐创作
└── 社区

Platform（平台层）
├── Core（核心能力）
├── Runtime（运行时）
├── Asset Center（资产管理）
├── Trust Engine（信任引擎）
├── License（授权）
├── Admin（统一后台）
├── SDK（@studio/platform）
└── kmki-ui（共享 UI 组件库）
```

**以后新增能力首先判断：它属于 Workspace，还是 Platform。** 而不是直接找一个目录开始写代码。

### 第二层：架构治理已形成闭环

| 文档 | 作用 | 问题 |
|------|------|------|
| SST | 定义系统结构 | 系统是什么？ |
| MOM | 定义模块归属 | 谁负责什么？ |
| DR | 定义依赖规则 | 谁能依赖谁？ |
| CR | 定义平台能力 | 哪些能力已经存在？ |
| PCD | 定义平台收敛 | 保留、迁移、废弃、删除？ |
| PI | 定义平台资产 | 工作台/Core/DB/API/UI 有哪些？ |

讨论一个新功能时，可以快速回答：放哪层？有复用吗？违反规则吗？需要新增什么？需要更新什么？

### 第三层：开发流程已标准化

```
需求
  ↓
查架构真相源（SST → CR → PI → MOM → DR → PCD）
  ↓
确定模块归属（Workspace / Core / Admin）
  ↓
SDP Sprint Delivery（Phase 0-11）
  ↓
验收
  ↓
更新六份架构真相源（硬性：不更新不合并）
  ↓
Freeze Tag
```

---

## 长期审计机制

V4.1 审计不是一次性工作。三个层级的审计作为长期机制：

| 层级 | 周期 | 执行 | 输出 |
|------|------|------|------|
| **Sprint 审计** | 每个 Sprint | OpenClaw 自审 + 用户验收 | SDP Checklist 验证 |
| **版本审计** | 每大版本（V4.2、V4.3 等） | 全平台 Architecture Audit | 更新六份架构真相源 |
| **收敛审计** | 每正式版本（V5.0 等） | Platform Convergence Review | 重新评估保留/迁移/删除策略 |

这些审计确保平台演化过程中架构漂移能被持续发现和修复。
