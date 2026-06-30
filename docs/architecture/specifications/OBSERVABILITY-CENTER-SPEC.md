# KMKI Platform — Observability Center Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-008 (Traceable), CONST-022 (Event-first), CONST-023 (公共契约)  
> **ADR Alignment**: ADR-007 (Trace-first Observability), ADR-015 (9-stage lifecycle)  
> **Blueprint Alignment**: Ch 8 (Observability Architecture)  
> **Dependencies**: Event Bus (唯一输入源)  
> **Error Cascade Direction**: Observability Center failure → no monitoring, no alerts, no dashboards, but execution continues  
> **Architecture Rule**: Observability Center 不调用任何下游 Center 的 API，不做任何业务请求，只消费 Event Bus 事件

---

## 1. Mission

全平台唯一的事件消费与观测中心。订阅所有 Center 发布的事件，聚合为 Trace / Metrics / Logs / Alerts / SLO / Audit，提供 Dashboard 与 Analysis。不执行业务，不查询 Provider，不修改状态。

## 2. Non-Responsibility

- 不调用 Runtime Center
- 不调用 Capability Center
- 不调用 AI Center
- 不调用任何 downstream Center API
- 不修改任何 Center 状态
- 不涉及 Provider、凭证、Credential
- 不存储业务数据

---

## 3. Core Data Models

### 3.1 ER Diagram

```
EventRecord (1) ──── (N) Span
       │
       ├── (N) MetricPoint
       ├── (N) LogEntry
       ├── (N) AuditRecord
       └── (N) AlertInstance

Dashboard (1) ──── (N) DashboardWidget

AlertRule (1) ──── (N) AlertInstance
SLO (1) ────────── (N) SLIEntry
```

### 3.2 EventRecord

```typescript
interface EventRecord {
  id: string
  eventName: string               // "execution.started.v1"
  source: string                  // "runtime" | "gateway" | "capability" | ...
  traceId: string
  spanId: string
  parentSpanId?: string
  payload: Record<string, any>    // 事件原始 Payload
  timestamp: Date
  receivedAt: Date
  indexed: boolean
}
```

### 3.3 Span (Distributed Trace)

```typescript
interface Span {
  spanId: string
  traceId: string
  parentSpanId?: string
  name: string                    // "runtime.execute"
  kind: 'internal' | 'client' | 'server' | 'producer' | 'consumer'
  status: 'ok' | 'error'
  startTime: Date
  endTime?: Date
  duration?: number               // 微秒
  attributes: Record<string, any> // 自定义属性
  events: SpanEvent[]
}

interface SpanEvent {
  name: string
  timestamp: Date
  attributes: Record<string, any>
}
```

### 3.4 MetricPoint

```typescript
interface MetricPoint {
  metricName: string              // "runtime_session_duration_ms"
  type: 'counter' | 'gauge' | 'histogram'
  value: number
  labels: Record<string, string>  // {"status": "completed", "capabilityId": "reason.generate"}
  timestamp: Date
}
```

### 3.5 LogEntry

```typescript
interface LogEntry {
  logId: string
  traceId: string
  spanId?: string
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string
  source: string                  // Center 名称
  service: string                 // 模块名
  attributes: Record<string, any>
  timestamp: Date
}
```

### 3.6 AuditRecord

```typescript
interface AuditRecord {
  auditId: string
  traceId: string
  userId: string
  workspaceId: string
  action: string                  // "capability.resolve" | "runtime.execute"
  resourceType: string            // "execution_session" | "capability"
  resourceId: string
  result: 'success' | 'failure' | 'denied'
  ip?: string
  userAgent?: string
  timestamp: Date
}
```

### 3.7 AlertInstance

```typescript
interface AlertInstance {
  alertId: string
  ruleName: string
  severity: 'critical' | 'warning' | 'info'
  status: 'firing' | 'resolved' | 'acknowledged'
  metricName: string
  condition: string               // "latency_p99 > 500ms"
  currentValue: number
  threshold: number
  firedAt: Date
  resolvedAt?: Date
  acknowledgedBy?: string
  notificationSent: boolean
}
```

### 3.8 AlertRule

```typescript
interface AlertRule {
  ruleName: string
  metricName: string
  condition: '>' | '<' | '==' | '>=' | '<='
  threshold: number
  duration: number                // 持续秒数
  severity: 'critical' | 'warning' | 'info'
  notification: {
    type: 'email' | 'webhook' | 'slack'
    target: string
  }
  enabled: boolean
}
```

### 3.9 SLIEntry & SLO

```typescript
interface SLIEntry {
  sliName: string                 // "runtime_availability"
  totalRequests: number
  goodRequests: number
  periodStart: Date
  periodEnd: Date
  value: number                   // 99.95
}

interface SLO {
  sloName: string                 // "runtime_availability"
  target: number                  // 99.95
  window: '7d' | '28d' | '90d'
  current: number
  remainingBudget: number          // 允许多少次失败
  status: 'green' | 'yellow' | 'red'
  updatedAt: Date
}
```

### 3.10 Dashboard & Widget

```typescript
interface Dashboard {
  id: string
  name: string
  workspaceId?: string            // null = 全局
  layout: WidgetLayout[]
  refreshInterval: number         // 秒
  createdAt: Date
  updatedAt: Date
}

interface WidgetLayout {
  widgetId: string
  type: 'timeseries' | 'gauge' | 'table' | 'stat' | 'heatmap' | 'event_list'
  title: string
  metrics: string[]
  labels: Record<string, string>
  position: { x: number, y: number, w: number, h: number }
  options?: Record<string, any>
}
```

---

## 4. Core Modules (8 Registries)

### 4.1 Trace Registry

**Responsibility**: 分布式追踪 — Span 创建、关联、持久化、查询。

```
TraceRegistry
  ├── createSpan(span: Span) → Span
  ├── endSpan(spanId, endTime?, error?) → void
  ├── getSpan(spanId) → Span
  ├── getTrace(traceId) → Span[]
  ├── getTraceTree(traceId) → SpanTree
  ├── queryTraces(filter) → Span[]
  └── getTraceTimeline(traceId) → SpanTimeline
```

**Trace 构建规则**:
```
Event → Span Mapping:

gateway.request.started.v1 → Span{name: "gateway.request", kind: server}
  │
  ├── identity.verify.auth.v1 → Span{name: "identity.verify", kind: client, parentSpanId: gatewaySpan}
  │
  ├── capability.resolve.started.v1 → Span{name: "capability.resolve", kind: client}
  │     └── capability.resolve.completed.v1 → endSpan
  │
  ├── runtime.execute.started.v1 → Span{name: "runtime.execute", kind: client}
  │     ├── runtime.node.started.v1 → Span{name: "runtime.node.llm", kind: internal}
  │     │     └── runtime.node.completed.v1 → endSpan
  │     └── runtime.completed.v1 → endSpan
  │
  └── gateway.request.completed.v1 → endSpan
```

### 4.2 Metrics Registry

**Responsibility**: 聚合 Metrics（Counter / Gauge / Histogram）并提供查询接口。

```
MetricsRegistry
  ├── recordCounter(name, value, labels) → void
  ├── setGauge(name, value, labels) → void
  ├── recordHistogram(name, value, labels) → void
  ├── queryMetric(name, labels, range) → MetricPoint[]
  ├── getAggregation(name, labels, window, fn) → number
  └── getMetricMetadata(name) → { type, description, labels[] }
```

**内置 Metrics 计算规则**:

| 事件 | Metrics 输出 |
|------|-------------|
| `gateway.request.completed.v1` | `gateway_requests_total++`, `gateway_request_latency_ms → Histogram` |
| `execution.started.v1` | `runtime_sessions_active++` |
| `execution.completed.v1` | `runtime_sessions_active--`, `runtime_session_duration_ms → Histogram` |
| `execution.node.completed.v1` | `runtime_node_latency_ms → Histogram`, `runtime_node_cost++` |
| `execution.failed.v1` | `runtime_sessions_failed++` |
| `gateway.rate_limit.hit.v1` | `gateway_requests_rate_limited++` |
| `gateway.auth.failed.v1` | `gateway_requests_auth_failed++` |

### 4.3 Log Registry

**Responsibility**: 结构化日志的接收、存储、索引、查询。

```
LogRegistry
  ├── ingest(entry: LogEntry) → void
  ├── query(filter) → LogEntry[]
  ├── getByTraceId(traceId) → LogEntry[]
  ├── getByLevel(level, since, until) → LogEntry[]
  └── aggregateLogs(filter) → { level: count }[]
```

**Log 源**:
```
日志源由各 Center 直接发布 LogEvent 到 Event Bus:
  log.recorded.v1 { source, level, message, traceId, attributes }
```

### 4.4 Event Registry

**Responsibility**: 事件索引和回放。

```
EventRegistry
  ├── index(event: EventRecord) → void
  ├── getEvent(eventId) → EventRecord
  ├── queryEvents(filter) → EventRecord[]
  ├── getEventTimeline(traceId) → EventRecord[]
  ├── replayEvents(eventNames[], since, until) → EventRecord[]
  └── getEventStats(eventName, since, until) → { count, firstAt, lastAt }
```

### 4.5 Alert Registry

**Responsibility**: 告警规则管理 + 告警实例生命周期。

```
AlertRegistry
  ├── createRule(rule: AlertRule) → void
  ├── updateRule(ruleName, rule) → void
  ├── deleteRule(ruleName) → void
  ├── getActiveAlerts(filter?) → AlertInstance[]
  ├── evaluateRules(metrics: MetricPoint[]) → AlertInstance[]
  ├── acknowledge(alertId, userId) → void
  └── resolve(alertId) → void
```

**Alert Evaluation Loop**:
```
每 30 秒执行（可配置）:
  │
  ▼ For each enabled AlertRule:
  │  currentValue = queryMetric(rule.metricName, rule.duration)
  │
  │  if (currentValue >= rule.threshold):
  │    if (no firing alert for this rule):
  │      create AlertInstance{status: firing}
  │      sendNotification(rule.notification)
  │
  │  if (currentValue < rule.threshold && there's a firing alert):
  │    resolve AlertInstance
  │
  ▼ Output: 更新的 AlertInstance[]
```

### 4.6 SLO Registry

**Responsibility**: SLI 采集 + SLO 计算 + 燃尽率追踪。

```
SLORegistry
  ├── recordSLI(sli: SLIEntry) → void
  ├── getSLO(sloName) → SLO
  ├── recalculateSLO(sloName) → SLO
  ├── getSLOBurnRate(sloName) → { daily, weekly, errorBudget }
  └── listSLOs() → SLO[]
```

**SLO 计算**:
```
SLO = (goodRequests / totalRequests) * 100

Error Budget = totalRequests * (1 - target)
Burn Rate = failedRequests / errorBudget per day

Status:
  green  → remaining budget > 50%
  yellow → remaining budget 20-50%
  red    → remaining budget < 20%
```

### 4.7 Dashboard Registry

**Responsibility**: Dashboard 配置管理 + 数据查询。

```
DashboardRegistry
  ├── createDashboard(dash: Dashboard) → void
  ├── getDashboard(id) → Dashboard
  ├── updateDashboard(id, dash) → void
  ├── deleteDashboard(id) → void
  ├── listDashboards(workspaceId?) → Dashboard[]
  └── renderWidget(widgetId, range) → { labels: [], values: [] }
```

### 4.8 Audit Registry

**Responsibility**: 审计日志的接收、不可篡改存储、查询。

```
AuditRegistry
  ├── record(audit: AuditRecord) → void
  ├── query(filter) → AuditRecord[]
  ├── getByUserId(userId, since, until) → AuditRecord[]
  ├── getByAction(action, since, until) → AuditRecord[]
  └── exportCSV(filter) → string   # 审计导出
```

**审计保留策略**:
- 标准: 90 天
- Premium: 365 天
- 审计数据不可删除（仅过期可归档）

---

## 5. Public API

### 5.1 Trace

```
GET    /api/observability/trace/:traceId    → Span[]
GET    /api/observability/trace/:traceId/tree → SpanTree
GET    /api/observability/trace/search      → Span[]
```

### 5.2 Metrics

```
GET    /api/observability/metrics/:name     → MetricPoint[]
GET    /api/observability/metrics/query     → { name: values }
GET    /api/observability/metrics/list      → MetricMetadata[]
```

### 5.3 Logs

```
GET    /api/observability/logs              → LogEntry[]
GET    /api/observability/logs/:traceId     → LogEntry[]
GET    /api/observability/logs/aggregate    → { level: count }
```

### 5.4 Events

```
GET    /api/observability/events            → EventRecord[]
GET    /api/observability/events/:eventName → EventRecord[]
GET    /api/observability/events/timeline/:traceId → EventRecord[]
POST   /api/observability/events/replay     → EventRecord[]
```

### 5.5 Alerts

```
GET    /api/observability/alerts            → AlertInstance[]
GET    /api/observability/alerts/:alertId   → AlertInstance[]
POST   /api/observability/alerts/:alertId/acknowledge → void
POST   /api/observability/alerts/rules       → AlertRule
GET    /api/observability/alerts/rules       → AlertRule[]
DELETE /api/observability/alerts/rules/:name → void
```

### 5.6 SLO

```
GET    /api/observability/slo               → SLO[]
GET    /api/observability/slo/:name         → SLO
GET    /api/observability/slo/:name/burnrate → { daily, weekly, errorBudget }
```

### 5.7 Dashboards

```
GET    /api/observability/dashboards        → Dashboard[]
GET    /api/observability/dashboards/:id    → Dashboard
POST   /api/observability/dashboards        → Dashboard
PUT    /api/observability/dashboards/:id    → Dashboard
DELETE /api/observability/dashboards/:id    → void
GET    /api/observability/dashboards/:id/render → WidgetData[]
```

### 5.8 Audit

```
GET    /api/observability/audit             → AuditRecord[]
GET    /api/observability/audit/export      → CSV
```

---

## 6. Events

Observability Center 订阅（Consumer ONLY — 全平台最大消费者）：

| Event Source | Event | Consumer Handler |
|--------------|-------|-----------------|
| **Gateway** | `gateway.request.started.v1` | TraceRegistry.createSpan, LogRegistry.ingest |
| **Gateway** | `gateway.request.completed.v1` | TraceRegistry.endSpan, MetricsRegistry (latency, count) |
| **Gateway** | `gateway.rate_limit.hit.v1` | MetricsRegistry (counter), AlertRegistry (evaluate) |
| **Gateway** | `gateway.auth.failed.v1` | MetricsRegistry (counter), AuditRegistry |
| **Identity** | `identity.token_revoked.v1` | AuditRegistry |
| **AI** | `provider.degraded.v1` | MetricsRegistry (gauge), AlertRegistry (evaluate) |
| **AI** | `provider.health_changed.v1` | MetricsRegistry (gauge) |
| **AI** | `model.registered.v1` | MetricsRegistry (gauge) |
| **AI** | `model.deprecated.v1` | MetricsRegistry (gauge) |
| **Capability** | `capability.registered.v1` | MetricsRegistry (gauge) |
| **Capability** | `capability.deprecated.v1` | MetricsRegistry (gauge) |
| **Capability** | `capability.resolved.v1` | MetricsRegistry (latency, count) |
| **Runtime** | `execution.started.v1` | TraceRegistry.createSpan, MetricsRegistry (counter, gauge), AuditRegistry |
| **Runtime** | `execution.node.started.v1` | TraceRegistry.createSpan |
| **Runtime** | `execution.node.completed.v1` | TraceRegistry.endSpan, MetricsRegistry (latency, cost) |
| **Runtime** | `execution.node.failed.v1` | TraceRegistry.endSpan (error), MetricsRegistry (counter, cost) |
| **Runtime** | `execution.paused.v1` | EventRegistry.index, MetricsRegistry (counter) |
| **Runtime** | `execution.resumed.v1` | EventRegistry.index, MetricsRegistry (counter) |
| **Runtime** | `execution.completed.v1` | TraceRegistry.endSpan, MetricsRegistry (duration, cost), AuditRegistry, SLORegistry.recordSLI |
| **Runtime** | `execution.failed.v1` | TraceRegistry.endSpan (error), MetricsRegistry, SLORegistry.recordSLI |
| **Runtime** | `execution.cancelled.v1` | TraceRegistry.endSpan, MetricsRegistry |
| **Runtime** | `artifact.created.v1` | MetricsRegistry (gauge) |
| **Runtime** | `artifact.deleted.v1` | MetricsRegistry (gauge) |
| **Common** | `log.recorded.v1` | LogRegistry.ingest |
| **Common** | `audit.recorded.v1` | AuditRegistry.record |

Observability Center 发布（Publisher）：

| Event | Payload | Guarantee | Subscriber |
|-------|---------|-----------|------------|
| `observability.alert.fired.v1` | `{alertId, ruleName, severity, metricName, currentValue, threshold}` | At Least Once | Notification Service |
| `observability.alert.resolved.v1` | `{alertId, ruleName}` | At Least Once | Notification Service |
| `observability.slo.changed.v1` | `{sloName, previousStatus, newStatus, remainingBudget}` | At Least Once | Dashboard |

---

## 7. Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Observability Center Service                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Event Bus Consumer (Listener)               │ │
│  │  订阅所有 Event → 分发到对应 Registry                    │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │             Pipeline (按 Event 类型路由)              │ │ │
│  │  │  TraceEvents → TraceRegistry                        │ │ │
│  │  │  MetricEvents → MetricsRegistry                     │ │ │
│  │  │  LogEvents    → LogRegistry                         │ │ │
│  │  │  AuditEvents  → AuditRegistry                       │ │ │
│  │  │  RawEvents    → EventRegistry                       │ │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Alert Evaluation Loop (每 30s) —→ AlertRegistry         │ │
│  │  SLO Recalculation Loop (每 5min) —→ SLORegistry         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              8 Registries                                │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │ │
│  │  │   Trace    │ │  Metrics   │ │    Log     │          │ │
│  │  │  Registry  │ │  Registry  │ │  Registry  │          │ │
│  │  └────────────┘ └────────────┘ └────────────┘          │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │ │
│  │  │   Event    │ │   Alert    │ │    SLO     │          │ │
│  │  │  Registry  │ │  Registry  │ │  Registry  │          │ │
│  │  └────────────┘ └────────────┘ └────────────┘          │ │
│  │  ┌────────────┐ ┌────────────┐                          │ │
│  │  │ Dashboard  │ │   Audit    │                          │ │
│  │  │  Registry  │ │  Registry  │                          │ │
│  │  └────────────┘ └────────────┘                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Repository Layer                             │ │
│  │  TraceDAO | MetricsDAO | LogDAO | EventDAO               │ │
│  │  AlertDAO | SLODAO | DashboardDAO | AuditDAO             │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Public Contract

### 8.1 Trace 查询

```
GET /api/observability/trace/kmki-20260720-a1b2c3d4/tree
→
{
  "traceId": "kmki-20260720-a1b2c3d4",
  "root": {
    "name": "gateway.request",
    "duration": 3420,
    "children": [
      {
        "name": "capability.resolve",
        "duration": 120,
        "children": []
      },
      {
        "name": "runtime.execute",
        "duration": 3100,
        "children": [
          { "name": "runtime.node.llm", "duration": 2850, "children": [] },
          { "name": "runtime.node.postprocess", "duration": 200, "children": [] }
        ]
      }
    ]
  }
}
```

### 8.2 Metric 查询

```
GET /api/observability/metrics/runtime_session_duration_ms?labels=status:completed&since=1h
→
[
  { "timestamp": "2026-07-20T11:00:00Z", "value": 3420, "labels": {"status": "completed"} },
  { "timestamp": "2026-07-20T11:05:00Z", "value": 2800, "labels": {"status": "completed"} }
]
```

### 8.3 错误格式

```json
{
  "success": false,
  "error": {
    "code": "TRACE_NOT_FOUND",
    "message": "Trace with ID kmki-xxx not found",
    "detail": "Trace may have been evicted from retention"
  },
  "traceId": "kmki-20260720-a1b2c3d4"
}
```

### 8.4 HTTP 状态码

| Code | 含义 |
|------|------|
| 200 | 成功 |
| 400 | 参数校验失败 |
| 404 | Trace/Metric/Dashboard 不存在 |
| 429 | 查询限流 |
| 500 | 存储错误 |

---

## 9. Failure Mode

| 场景 | 行为 |
|------|------|
| 存储不可用 | 事件缓冲到内存队列，存储恢复后批量写入 |
| Trace 存储不可用 | Metrics/Logs/Events 正常，Trace 临时跳过 |
| Metrics 存储不可用 | Trace/Logs 正常，Metrics 缓冲 |
| Alert 评估循环失败 | 跳过本轮，下一周期继续 |
| Dashboard 查询超时 | 返回部分数据 + 超时标记 |
| Event Bus Consumer 断开 | 自动重连，断连期间事件丢失（At Most Once）|
| 内存队列满 | 丢弃最旧事件（按优先级: Log < Events < Metrics < Traces < Alerts）|
| 全部不可用 | 不影响 Data Plane 执行，仅 Control Plane 离线 |

---

## 10. Recovery

| 场景 | 恢复步骤 |
|------|---------|
| 存储恢复 | 从内存缓冲队列批量写入 → 恢复 Consumer → 继续消费 |
| Event Bus 重连 | 重新订阅所有事件 → 无回溯 |
| 进程重启 | Trace/Metrics 从存储恢复 → 过去数据可查 |
| Dashboard 启动 | 从存储加载配置 → 开始渲染 |

---

## 11. Replacement Strategy

1. 新 Observability Center 实现相同 API
2. 切换到新 Event Bus Topic
3. 旧 Observability Center 保持 7 天（历史数据只读）
4. 确认后迁移

---

## 12. Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `observability_events_received_total` | Counter | source, eventName | 收到的事件总数 |
| `observability_events_processed_total` | Counter | registry | 已处理的事件数 |
| `observability_events_dropped_total` | Counter | reason | 丢弃事件数 |
| `observability_storage_latency_ms` | Histogram | registry | 存储写入延迟 |
| `observability_query_latency_ms` | Histogram | endpoint | 查询延迟 |
| `observability_alert_fired_total` | Counter | severity | 告警触发次数 |
| `observability_slo_green_total` | Gauge | sloName | 绿色的 SLO 数 |
| `observability_active_traces` | Gauge | — | 活跃 Trace 数 |

---

## 13. Health Endpoint

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    event_bus: { status: 'ok' | 'error', consumerLag: number },
    trace_store: { status: 'ok' | 'error', latency: number },
    metrics_store: { status: 'ok' | 'error', latency: number },
    log_store: { status: 'ok' | 'error', latency: number },
    alert_evaluator: { status: 'ok' | 'error', lastRun: Date }
  },
  event_summary: {
    received: number,
    processed: number,
    dropped: number
  },
  alert_summary: {
    firing: number,
    acknowledged: number
  }
}
```

---

## 14. SLO

| SLI | Target |
|-----|--------|
| Event ingestion latency P99 | < 100ms |
| Trace query latency P99 | < 300ms |
| Metric query latency P99 | < 200ms |
| Dashboard render latency P99 | < 1s |
| Alert evaluation latency P99 | < 5s |
| Data retention (Trace) | 7 天 |
| Data retention (Metrics) | 90 天 |
| Data retention (Logs) | 30 天 |
| Data retention (Audit) | 90 天 (Standard) / 365 天 (Premium) |
| Availability (per month) | 99.9% |

---

> **Observability Center 不执行业务，不修改状态，不查询 Provider。它只是一个订阅者。但它是平台唯一能看到全局的 Center。**
