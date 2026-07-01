# Knowledge Hub Runtime Baseline v5 — Monitoring & Observability

> **日期**: 2026-07-22
> **版本**: v5.0  
> **状态**: ✅ FROZEN

---

## 架构

```
                     ObservabilityEngine
                    ┌──────────────────┐
                    │                  │
  HealthEngine ─────┤    Snapshot      │
  MetricsRegistry ──┤    Unification   │
  AuditExplorer  ───┤                  │
  AlertManager   ───┤                  │
                    └──────────────────┘
                           │
                    Platform Console
                    (Dashboard)
```

Dashboard 不聚合数据，只消费 `ObservabilitySnapshot`。

### 新增模块

| 模块 | 文件 | 说明 |
|------|------|------|
| ObservabilityEngine | `monitoring/observability-engine.ts` | 唯一聚合入口 |
| HealthEngine | `monitoring/health-engine.ts` | 统一健康模型 (healthy/warning/degraded/unavailable) |
| MetricsRegistry | `monitoring/metrics-registry.ts` | 10 个平台指标定义 |
| AuditExplorer | `monitoring/audit-explorer.ts` | Audit Timeline 查询 (按 Package/类型/时间) |
| AlertManager | `monitoring/alert-manager.ts` | 策略化告警 (metric/threshold/operator/severity) |
| MonitoringAPI | `monitoring/api.ts` | 8 个端点 |

### 健康维度

| Component | 说明 |
|-----------|------|
| Runtime | 平台运行时 |
| Queue | 任务队列 |
| Providers | Provider 状态 |
| Publishers | Publisher 状态 |
| Distribution Targets | 分发目标 |
| APIs | API 端点 |

### 首批 10 个指标

| 指标 | 类型 | 单位 |
|------|------|------|
| packages_created_total | counter | count |
| validation_success_rate | gauge | % |
| review_throughput | gauge | count/h |
| review_sla_ms | histogram | ms |
| publish_success_rate | gauge | % |
| distribution_success_rate | gauge | % |
| retry_count_total | counter | count |
| publish_duration_ms | histogram | ms |
| queue_depth | gauge | count |
| provider_availability | gauge | % |

### Monitoring API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/knowledge/monitoring/overview | 统一快照 |
| GET | /api/knowledge/monitoring/health | 健康报告 |
| GET | /api/knowledge/monitoring/metrics | 指标 |
| GET | /api/knowledge/monitoring/audit | 审计查询 |
| GET | /api/knowledge/monitoring/jobs | 活跃 Job |
| GET | /api/knowledge/monitoring/alerts | 告警 |
| POST | /api/knowledge/monitoring/alerts/rules | 创建告警规则 |
| POST | /api/knowledge/monitoring/health/report | 报告健康状态 |

### Observability Gate 验证

| Gate | 验收项 | 状态 |
|------|--------|------|
| **Monitoring Gate** | Dashboard 不聚合数据 | ✅ ObservabilityEngine 唯一聚合 |
| | Metrics 来自 Registry | ✅ 10 个指标定义 |
| | Health 来自 HealthEngine | ✅ 统一模型 |
| **Operations Gate** | 所有 Job 可追踪 | ✅ Distribution jobs |
| | 所有 Event 可查询 | ✅ Audit Explorer |
| | 所有 Target 有健康状态 | ✅ HealthEngine |
| | 所有异常有统一错误模型 | ✅ |

### 线上验证

```
POST /monitoring/health/report → Runtime healthy, Providers healthy ✅
GET  /monitoring/overview → Health: healthy, components: [Runtime, Providers] ✅
GET  /monitoring/metrics → 10 metrics defined ✅
GET  /monitoring/audit → 0 events (in-memory, fresh start) ✅
POST /monitoring/alerts/rules → Critical alert rule created ✅
GET  /monitoring/alerts → 2 rules, 0 active ✅
GET  /monitoring/jobs → distribution jobs tracked ✅
```
