## knowledge-hub-v1.0-rc1 (2026-07-22)

Knowledge Hub 平台正式冻结。

### KH1 — Canonical Package Runtime
- PackageBuilder: 统一知识包构建
- PackageValidator: 多层校验
- VersionEngine: 版本化 + 快照
- ProviderRuntime: 4 个 Provider 注册

### KH2 — Publishing Engine
- PublishingEngine: 统一发布入口
- PublisherRegistry: 4 个 Publisher
- PublishingQueue: 异步 Job 模型

### KH3 — Review / Approval
- ReviewEngine: 审核生命同期
- ApprovalEngine: 统一审批入口
- AuditTimeline: 13 种平台事件

### KH4 — Distribution
- DistributionEngine: 分发执行
- DistributionRegistry: 4 个 Target
- ExecutionGraph: Plan → Task → Result

### KH5 — Monitoring & Observability
- ObservabilityEngine: 统一快照
- HealthEngine: 健康模型
- MetricsRegistry: 10 个指标
- AlertManager: 策略化告警

### Platform RC Gate (7/7)
- Architecture Audit: Boundary + Layer Isolation ✅
- End-to-End Regression: 12/12 步 ✅
- Extensibility Audit: Registry 扩展 ✅
- Operational Readiness: Health/Metrics/Audit/Alerts ✅
- Documentation Freeze: Blueprint + Constitution ✅
- Compatibility: 4 Workspace Stubs 兼容 ✅
- Platform Tag: knowledge-hub-v1.0-rc1 ✅

---


# CHANGELOG

## geo-v1.0-rc1 (2026-07-22)

GEO Workspace v1.0 Release Candidate 1 — 产品功能基线冻结。

### Features
- Dashboard Mission Control — 品牌优先级 + 今日进度 + 继续旅程
- Brand Overview — AI 可见度、Explanations、Recommendations、Action Plans、Verification
- Discovery Lab — 品牌发现与场景扫描
- Knowledge Hub — 知识来源管理
- Verification Engine — 验证结果与时间线
- Health Dashboard — 品牌健康度监控
- Growth Dashboard — 增长指标追踪
- Publishing Dashboard — 发布与收录管理
- Recommendations Center — 推荐与优化建议
- Report Center — 报告生成与导出

### Architecture
- SSOT: ExplainResult / EngineResult / WorkflowState 全部唯一来源
- Provider Registry: 所有 AI Provider 通过 Registry 注册
- Explain Provider: Discovery / Recommendation / Verification / Presence 四类
- Workflow Engine: 状态机驱动
- Platform Boundary: GEO 不直引 Platform 核心代码

### Fixes
- walkthrough/state: PrismaClient 缓存不同步 → 重跑 `prisma generate`
- verificationResult: 排序字段 `createdAt` → `verifiedAt`
- `analysisLoading` ReferenceError → 修复为 `loading.value`
- /workspace/geo/brand/:id/presence 404 → 改为 query param `?tab=presence`

### Documentation
- 产品白皮书 v1.0
- 路线图 v1.0
- 页面蓝图 v1.0
- 能力矩阵 v1.0
- Sprint Backlog v1.0
- 功能门禁 v1.0
- 验收标准 v1.0
- 演示脚本 v1.0
- ADR-020 Brand Domain

### Notes
- 前端: Nuxt SPA, 222 assets
- 后端: Fastify + Prisma + tsx
- 回滚 tag: `geo-workspace-product-rc1`
