# RC3 Execution Plan — 执行计划

**生成日期**: 2026-07-01
**目标**: 按优先级和依赖关系依次完成 RC3 Backlog 中的全部 42 个 Task

---

## 执行阶段总览

```
Phase 0: Foundation (P0)         → Week 1-2
Phase 1: Core ADI (P0)           → Week 3-5
Phase 2: Scenario & Demand (P0)  → Week 4-6
Phase 3: Publishing & Monitor    → Week 5-7
Phase 4: Outcomes & Dogfooding   → Week 7-9
Phase 5: Polish & Optimization   → Week 9-10
```

---

## Phase 0 — Foundation (P0, 无依赖先行)

**目标**: 为所有后续工作打下基础

| 顺序 | Task | 说明 | 估算 |
|------|------|------|------|
| 0.1 | E1.6 — ADI Prisma 模型 | 新增 ADISnapshot, ADIDimension 等模型 + Migration | M |
| 0.2 | E3.1 — Scenario Type 定义 | 定义 Scenario 类型体系和接口 | M |
| 0.3 | E4.1 — Demand Query Model 定义 | 定义自然语言查询模型 | M |
| 0.4 | E6.1 — Business Outcome 模型 | Prisma 模型 + Migration | M |
| 0.5 | E10.1 — 架构一致性审计 | 全面审计 + 输出迁移路线图 | M |

**阶段交付**: 数据库模型就绪，架构迁移路线图完成

---

## Phase 1 — Core ADI (P0)

**目标**: 实现 ADI 作为主 KPI，建立 AI Discovery Lab

| 顺序 | Task | 说明 | 估算 | 依赖 |
|------|------|------|------|------|
| 1.1 | E1.1 — ADI Calculator | 核心 ADI 计算逻辑 (Coverage/Share/Position) | L | 0.1 |
| 1.2 | E1.2 — ADI API | `/api/geo/adi/:projectId` 端点 | M | 1.1 |
| 1.3 | E1.3 — ADI Store | Pinia store + services | S | 1.2 |
| 1.4 | E2.1 — Discovery Lab Page | 全新页面容器 | L | 1.2 |
| 1.5 | E2.2 — Coverage Analysis Panel | 覆盖分析面板 | M | 1.4 |
| 1.6 | E2.3 — Share Analysis Panel | 份额分析面板 | M | 1.4 |
| 1.7 | E2.4 — Position Analysis Panel | 位置分析面板 | M | 1.4 |
| 1.8 | E1.4 — Dashboard 重构 | GEODashboard 从 BII 改为 ADI 主 KPI | L | 1.3 |
| 1.9 | E1.5 — HealthPage ADI 集成 | HealthPage 增加 ADI 展示 | M | 1.1 |

**阶段交付**: ADI 计算完整 + Discovery Lab 页面可用 + Dashboard 以 ADI 为主

---

## Phase 2 — Scenario & Demand Intelligence (P0→P1)

**目标**: 实现 Scenario First 和 Natural Language First

| 顺序 | Task | 说明 | 估算 | 依赖 |
|------|------|------|------|------|
| 2.1 | E3.2 — Scenario Model + Service | 后端服务 | M | 0.2 |
| 2.2 | E3.3 — Scenario API | CRUD + 查询 | M | 2.1 |
| 2.3 | E3.4 — Scenario Library UI | 场景库管理页面 | L | 2.2 |
| 2.4 | E4.2 — Demand Corpus Service | 语料库服务 | M | 0.3 |
| 2.5 | E4.3 — Demand Corpus API | CRUD + 搜索 | M | 2.4 |
| 2.6 | E4.4 — Demand Corpus UI | 语料库管理页面 | L | 2.5 |
| 2.7 | E5.1 — Demand Intelligence Engine | 分析引擎 | L | 2.2, 2.5 |
| 2.8 | E3.5 — Scenario-Discovery 绑定 | 场景与发现关联 | L | 2.1, 1.1 |
| 2.9 | E5.2 — Demand-Scenario 匹配 Dashboard | 匹配展示 | M | 2.7 |

**阶段交付**: Scenario Library 可管理 + Demand Corpus 可导入 + 发现-场景关联显示

---

## Phase 3 — Publishing & Monitor Enhancement (P1)

**目标**: 完成 Publishing UI 和 Monitor 趋势能力

| 顺序 | Task | 说明 | 估算 | 依赖 |
|------|------|------|------|------|
| 3.1 | E8.3 — Publishing UI 完整化 | Draft→Review→Approve→Publish 交互 | M | — |
| 3.2 | E8.4 — Publishing Rollback UI | 回滚界面 | S | 3.1 |
| 3.3 | E8.2 — Entity Versioning | Entity 级别版本管理 | M | — |
| 3.4 | E7.1 — Discovery Trend Probe | 发现趋势探针 | M | 1.1 |
| 3.5 | E7.2 — Coverage Trend Probe | 覆盖趋势探针 | M | 1.1 |
| 3.6 | E7.3 — Monitor Trend Dashboard | 趋势可视化 | M | 3.4, 3.5 |

**阶段交付**: Publishing 全生命周期 UI 可用 + Monitor 趋势面板上线

---

## Phase 4 — Business Outcomes & Dogfooding (P1→P2)

**目标**: 实现业务成果追踪和昆仑镜自评

| 顺序 | Task | 说明 | 估算 | 依赖 |
|------|------|------|------|------|
| 4.1 | E6.2 — Outcome Tracking Service | Discovery/Engagement/Conversion/Retention | M | 0.4 |
| 4.2 | E6.3 — Outcome Dashboard | 业务成果仪表盘 | M | 4.1 |
| 4.3 | E2.5 — Opportunity Identification | 发现机会自动识别 | L | 2.1 |
| 4.4 | E2.6 — Discovery History Timeline | 发现历史时间线 | M | 2.2 |
| 4.5 | E9.2 — Dogfooding | 昆仑镜自评框架 | M | 1.1 |
| 4.6 | E9.1 — Explainability 集成到 ADI Lab | 解释性面板 | M | 2.1 |
| 4.7 | E5.3 — Demand Gap Analysis | 需求未覆盖分析 | M | 2.7 |

**阶段交付**: 业务成果可追踪 + 昆仑镜可自评 + 发现机会自动识别

---

## Phase 5 — Polish & Housekeeping (P2)

**目标**: 完善细节、清理债务

| 顺序 | Task | 说明 | 估算 | 依赖 |
|------|------|------|------|------|
| 5.1 | E8.1 — Registry Public Portal | 公开注册中心门户 | L | — |
| 5.2 | E9.3 — Benchmark Runner 可视化 | Job 状态和结果界面 | S | — |
| 5.3 | E10.2 — 弃用模块清理 | 删除 legacy + .bak 文件 | S | 10.1 |
| 5.4 | E10.3 — 测试覆盖补全 | 关键路径测试 | L | — |
| 5.5 | E4.5 — Query-Scenario 映射 | NL查询→场景自动映射 | L | 2.1, 2.5 |

**阶段交付**: Public Portal 上线 + 代码库清理 + 测试覆盖

---

## 执行顺序依赖图

```
Phase 0 ──────────────────────────────────────────────────────
  ├─ 0.1 ADI Prisma ─┐
  ├─ 0.2 Scenario Type ─┐
  ├─ 0.3 Demand Model ─┐
  ├─ 0.4 Outcome Model ─┐
  └─ 0.5 Arch Audit ────┐
                        │
Phase 1 ────────────────┼─────────────────────────────────────
  ├─ 1.1 ADI Calc ◄────┘
  ├─ 1.2 ADI API ◄──────┘
  ├─ 1.3 ADI Store ◄────┘
  ├─ 1.4-1.7 Discovery Lab ◄── 1.2
  ├─ 1.8 Dashboard Rebuild ◄── 1.3
  └─ 1.9 HealthPage ADI ◄── 1.1
 
Phase 2 ────────────────┼─────────────────────────────────────
  ├─ 2.1-2.3 Scenario ◄── 0.2
  ├─ 2.4-2.6 Demand Corpus ◄── 0.3
  ├─ 2.7 Demand Engine ◄── 2.2 + 2.5
  ├─ 2.8 Scenario-Discovery ◄── 2.1 + 1.1
  └─ 2.9 Demand-Scenario ◄── 2.7

Phase 3 ────────────────┼─────────────────────────────────────
  ├─ 3.1-3.2 Publishing UI
  ├─ 3.3 Entity Versioning
  ├─ 3.4-3.5 Monitor Probes ◄── 1.1
  └─ 3.6 Monitor Dashboard ◄── 3.4 + 3.5

Phase 4 ────────────────┼─────────────────────────────────────
  ├─ 4.1 Outcome Service ◄── 0.4
  ├─ 4.2 Outcome Dashboard ◄── 4.1
  ├─ 4.3 Opportunity ◄── 2.1
  ├─ 4.4 Discovery History ◄── 2.2
  ├─ 4.5 Dogfooding ◄── 1.1
  ├─ 4.6 Explainability ◄── 2.1
  └─ 4.7 Demand Gap ◄── 2.7

Phase 5 ────────────────┼─────────────────────────────────────
  ├─ 5.1 Public Portal
  ├─ 5.2 Benchmark UI
  ├─ 5.3 Cleanup ◄── 0.5
  ├─ 5.4 Tests
  └─ 5.5 Query-Scenario ◄── 2.1 + 2.5
```

---

## 资源估算总计

| Phase | 任务数 | P0 | P1 | P2 | 估算总人天 |
|-------|--------|----|----|----|-----------|
| Phase 0 | 5 | 3 | 1 | 1 | 15 |
| Phase 1 | 9 | 9 | 0 | 0 | 35 |
| Phase 2 | 9 | 5 | 4 | 0 | 40 |
| Phase 3 | 6 | 0 | 6 | 0 | 18 |
| Phase 4 | 7 | 0 | 5 | 2 | 25 |
| Phase 5 | 5 | 0 | 0 | 5 | 18 |
| **总计** | **42** | **17** | **15** | **10** | **~151 人天** |

---

## 关键里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1: ADI Ready | Phase 1 完成 | ADI Calculator + API + Dashboard 重构 |
| M2: Discovery Lab 上线 | Phase 1 完成 | Discovery Lab 页面 + 三个分析面板 |
| M3: Scenario 可用 | Phase 2 前半 | Scenario Library API + UI |
| M4: Demand 可用 | Phase 2 后半 | Demand Corpus API + UI |
| M5: Publishing 完整 | Phase 3 完成 | Publishing 全生命周期 UI |
| M6: Monitor 增强 | Phase 3 完成 | Discovery/Coverage Trend |
| M7: RC3 Complete | Phase 5 完成 | 全部 42 个 Task |
