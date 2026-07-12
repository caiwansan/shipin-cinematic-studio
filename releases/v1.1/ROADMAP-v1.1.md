# v1.1 Development Roadmap

**Baseline:** v1.0.1 (frozen)
**Target Release:** v1.1.0
**Status:** ✅ Sprint 1 完成，Sprint 2 Planning 中

## ✅ Sprint 1 — Explainability Platform v1.0（已冻结，ADR-001）

架构已锁定，Explain 作为 GEO 横向平台能力：
- 一个 ExplainDocument（唯一 SSOT）
- 一个统一 Explain API（`GET /api/geo/explain?type=&id=`）
- 一个 Explain Engine（仅路由）
- 一个 ExplainDocumentBuilder（纯组装，NO COMPUTATION）
- 一个数据驱动 Explain Renderer（Section 渲染）
- 5 个 Explain Provider（Mission/Discovery/Recommendation/Verification/Presence）
- 6 条架构冻结规则（ADR-001）

## Sprint 2 — Execution Runtime（当前 Sprint）

Mission 从"建议"升级为"可执行方案"。拆为 4 个 RC：

### RC1 — Runtime Foundation
DAG 调度引擎核心：ExecutionGraph / DAGScheduler / State Machine / 3 个平台对象（Context/Artifact/Event）

### RC2 — Provider Runtime
CapabilityRouter + Retry + Circuit Breaker + Fallback + ProviderPolicy

### RC3 — Execution Planning
ExecutionRequest + MissionExecutionAdapter + ExecutionPlanner + Cost/Duration Estimator

### RC4 — Execution Experience
Execution API + Timeline + ExecutionExplainProvider（Trace → ExplainDocument，复用 Sprint 1 Renderer）

## Sprint 3 — Workspace Productization

## Sprint Backlog

| Sprint | Focus | Priority Items | Duration |
|--------|-------|----------------|----------|
| Sprint 1 | Mission Explainability | P1 items 1, 2, 3 | 2 weeks |
| Sprint 2 | Execution Orchestrator | P2 items 4, 5, 6 | 2 weeks |
| Sprint 3 | Workspace Productization | P3 items 7, 8, 9 + P4 items 10, 11, 12 | 2 weeks |

**Total estimated: 6 weeks → Target v1.1 RC by mid-August 2026**
