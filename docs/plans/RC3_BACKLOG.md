# RC3 Product Backlog — 产品待办列表

**生成日期**: 2026-07-01
**状态说明**: 
- Complete = 功能已实现并通过验证
- Partial = 功能部分实现，有关键缺失
- Missing = 功能完全不存在

---

## Backlog 表

| Epic | Task | Status | Priority | Depends On | Estimate |
|------|------|--------|----------|------------|----------|
| **Epic 1: ADI First 重构** | | | | | |
| E1.1 | ADI Calculator — 实现 ADI 计算器（Coverage/Share/Position） | Missing | P0 | — | L |
| E1.2 | ADI API — 新增 GET /api/geo/adi/:projectId 端点 | Missing | P0 | E1.1 | M |
| E1.3 | ADI Store — 前端新增 useADIStore | Missing | P0 | E1.2 | S |
| E1.4 | Dashboard 重构 — 从 BII 主 KPI 改为 ADI 主 KPI | Missing | P0 | E1.1, E1.3 | L |
| E1.5 | HealthPage 重构 — 集成 ADI 展示 | Missing | P0 | E1.1 | M |
| E1.6 | Prisma — 新增 ADI 相关模型（ADISnapshot, ADIDimension） | Missing | P0 | — | M |
| **Epic 2: AI Discovery Lab** | | | | | |
| E2.1 | Discovery Lab 页面 — 全新 DiscoveryLab.vue 页面 | Missing | P0 | E1.1 | L |
| E2.2 | Coverage Analysis — 品牌 AI 覆盖分析面板 | Missing | P0 | E2.1 | M |
| E2.3 | Share Analysis — 品牌 AI 提及份额分析面板 | Missing | P0 | E2.1 | M |
| E2.4 | Position Analysis — 品牌 AI 排名位置分析面板 | Missing | P0 | E2.1 | M |
| E2.5 | Opportunity Identification — 自动识别发现机会 | Missing | P1 | E2.1 | L |
| E2.6 | Discovery History Timeline — 发现趋势时间线 | Missing | P1 | E2.1 | M |
| **Epic 3: Scenario Library** | | | | | |
| E3.1 | Scenario Type 定义 — 定义 Scenario 类型体系 | Missing | P0 | — | M |
| E3.2 | Scenario Model — Prisma + 后端 Service | Missing | P0 | E3.1 | M |
| E3.3 | Scenario Library API — CRUD + 查询 | Missing | P0 | E3.2 | M |
| E3.4 | Scenario Library UI — 场景库管理页面 | Missing | P0 | E3.3 | L |
| E3.5 | Scenario-Discovery 绑定 — 场景与发现数据关联 | Missing | P1 | E3.2, E1.1 | L |
| **Epic 4: Natural Demand Corpus** | | | | | |
| E4.1 | Demand Query Model — 自然语言查询模型定义 | Missing | P0 | — | M |
| E4.2 | Demand Corpus Service — 语料库管理服务 | Missing | P0 | E4.1 | M |
| E4.3 | Demand Corpus API — CRUD + 搜索 | Missing | P0 | E4.2 | M |
| E4.4 | Demand Corpus UI — 语料库管理/导入页面 | Missing | P1 | E4.3 | L |
| E4.5 | Query-Scenario 映射 — 自然语言查询自动映射到场景 | Missing | P1 | E4.1, E3.1 | L |
| **Epic 5: Demand Intelligence** | | | | | |
| E5.1 | Demand Intelligence Engine — 需求智能分析引擎 | Missing | P1 | E4.1, E3.1 | L |
| E5.2 | Demand-Scenario 匹配 Dashboard — 需求和场景匹配展示 | Missing | P1 | E5.1 | M |
| E5.3 | Demand Gap Analysis — 需求未覆盖分析 | Missing | P1 | E5.1 | M |
| **Epic 6: Business Outcomes** | | | | | |
| E6.1 | Business Outcome Model — Prisma 模型 + Migration | Missing | P1 | — | M |
| E6.2 | Outcome Tracking Service — Discovery/Engagement/Conversion/Retention | Missing | P1 | E6.1 | M |
| E6.3 | Outcome Dashboard — 业务成果仪表盘 | Missing | P2 | E6.2 | M |
| **Epic 7: Monitor Enhancement** | | | | | |
| E7.1 | Discovery Trend Probe — 发现趋势监控探针 | Missing | P1 | E1.1 | M |
| E7.2 | Coverage Trend Probe — 覆盖趋势监控探针 | Missing | P1 | E1.1 | M |
| E7.3 | Monitor Trend Dashboard — 趋势可视化面板 | Missing | P1 | E7.1, E7.2 | M |
| **Epic 8: Registry & Publishing** | | | | | |
| E8.1 | Registry Public Portal — 公开注册中心门户 | Missing | P2 | — | L |
| E8.2 | Entity Versioning — Entity 级别版本管理 | Partial | P1 | — | M |
| E8.3 | Publishing UI 完整化 — Draft→Review→Approve→Publish 交互 | Partial | P1 | — | M |
| E8.4 | Publishing Rollback UI — 发布回滚界面 | Missing | P2 | E8.3 | S |
| **Epic 9: Explainability & Dogfooding** | | | | | |
| E9.1 | Explainability 集成到 ADI Lab | Partial | P1 | E2.1 | M |
| E9.2 | Dogfooding — 昆仑镜自评框架 | Missing | P2 | E1.1 | M |
| E9.3 | Benchmark Runner 可视化 — Job 状态和结果 | Partial | P2 | — | S |
| **Epic 10: Housekeeping** | | | | | |
| E10.1 | 架构一致性审计 — 输出迁移计划 | Missing | P2 | — | M |
| E10.2 | 弃用模块清理 — 删除 legacy/brand-geo 和 .bak 文件 | Partial | P2 | — | S |
| E10.3 | 测试覆盖补全 — 各模块关键路径测试 | Partial | P2 | — | L |

---

## 汇总统计

| 维度 | 数量 |
|------|------|
| 总 Epic 数 | 10 |
| 总 Task 数 | 42 |
| P0 Tasks | 17 |
| P1 Tasks | 15 |
| P2 Tasks | 10 |
| Complete | 0 (新任务) |
| Partial | 6 |
| Missing | 36 |
| 估算 S | 4 |
| 估算 M | 24 |
| 估算 L | 14 |
