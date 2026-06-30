# KMKI Platform — Center SDK Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-001–CONST-029（所有 29 条规则约束）  
> **ADR Alignment**: ADR-001–ADR-020（所有 20 个决策记录约束）  
> **Layers**: Constitution → ADR → Blueprint → **Center SDK** → Center Template → Center Spec → Implementation  
> **Scope**: 所有 KMKI Platform Center 必须使用 Center SDK 实现。禁止自行实现基础模块。

---

## 1. Mission

全平台所有 Center 统一的基础开发框架。提供强制性的生命周期、分层架构、Event Bus 集成、Health、Metrics、SLO、错误处理、DTO 规范。确保任何新 Center 在首次提交代码时已经符合所有架构约束。

## 2. Core Principle

```
所有 Center 必须使用 Center SDK 初始化。
所有 Center 必须遵守分层调用规则。
所有 Center 必须发布 5 个基础事件。
所有 Center 必须暴露 /health 端点。
所有 Center 必须注册到 Gateway。
```

## 3. Center Bootstrap

### 3.1 Center 初始化

```typescript
// === 所有 Center 的入口 ===
import { createCenter } from '@kmki/center-sdk'

const center = createCenter({
  name: 'capability',
  displayName: 'Capability Center',
  version: '1.0.0',
  dependencies: ['identity', 'ai'],
  registries: ['CapabilityRegistry', 'ProfileRegistry'],  // 实际注册的 Registry 类
  setup: async (ctx: CenterContext) => {
    // 自定义初始化逻辑
  }
})

center.start()
```

### 3.2 CenterContext

```typescript
interface CenterContext {
  name: string
  version: string
  config: CenterConfig

  // 基础设施
  logger: CenterLogger
  metrics: CenterMetrics
  health: CenterHealth
  eventBus: CenterEventBus
  repository: CenterRepository

  // 生命周期的钩子
  hooks: {
    onStart: () => Promise<void>
    onStop: () => Promise<void>
    onHealth: () => Promise<HealthCheckResult>
  }
}
```

### 3.3 CenterConfig

```typescript
interface CenterConfig {
  port: number
  database?: {
    type: 'postgres' | 'mysql' | 'sqlite'
    url: string
    poolSize: number
  }
  cache?: {
    type: 'redis' | 'memory'
    url: string
    ttlSeconds: number
  }
  eventBus: {
    type: 'rabbitmq' | 'kafka' | 'redis'
    url: string
    consumerGroup: string
    prefetchCount: number
  }
}
```

---

## 4. 强制分层

### 4.1 分层调用规则

```
Layer 0:  Gateway（Center 不暴露端口，仅通过 Gateway 访问）
              │
              ▼
Layer 1:  Service（业务编排、调用 Registry）
              │
              ▼
Layer 2:  Registry（业务能力注册 / 查询）
              │
              ▼
Layer 3:  Repository（数据访问接口）
              │
              ▼
Layer 4:  DAO（数据库 / 缓存具体实现）
```

### 4.2 分层约束（SDK 强制执行）

```typescript
// === 禁止规则（由 TypeScript 定义时通过 lint 捕获）=== //

// ❌ Service 不能直接访问 DAO
class Service {
  // WRONG: this.dao.userDao.query()
  // RIGHT: this.registry.userRegistry.getById()
}

// ❌ Registry 不能直接访问外部 HTTP
class Registry {
  // WRONG: axios.get('https://other-center/...')
  // RIGHT: 通过 Event Bus 通信
}

// ❌ Repository 不能包含业务逻辑
class Repository {
  // WRONG: if (user.tier === 'premium') { ... }
  // RIGHT: 只做 CRUD + 查询
}
```

### 4.3 依赖注入

```typescript
// 所有 Center 使用统一的 DI 容器
const container = center.createContainer()

container.register('CapabilityRegistry', CapabilityRegistry)
container.register('ProfileRegistry', ProfileRegistry)
container.register('CapabilityRepository', CapabilityRepository)

const registry = container.resolve('CapabilityRegistry')
```

---

## 5. 基础模块

### 5.1 CenterLogger

```typescript
// 统一的日志接口。所有 Center 日志必须通过 CenterLogger。
interface CenterLogger {
  info(message: string, attributes?: Record<string, any>): void
  warn(message: string, attributes?: Record<string, any>): void
  error(message: string, error?: Error, attributes?: Record<string, any>): void
  debug(message: string, attributes?: Record<string, any>): void
  fatal(message: string, error: Error): void

  // 自动注入 traceId
  withTrace(traceId: string): CenterLogger
  // 自动注入 spanId
  withSpan(spanId: string): CenterLogger
}

// 输出格式（所有 Center 统一）:
// {"level":"info","message":"xxx","timestamp":"2026-07-20T12:00:00Z","attributes":{...}}
```

### 5.2 CenterMetrics

```typescript
// 统一的 Metrics 接口。
interface CenterMetrics {
  counter(name: string, value: number, labels?: Record<string, string>): void
  gauge(name: string, value: number, labels?: Record<string, string>): void
  histogram(name: string, value: number, labels?: Record<string, string>, buckets?: number[]): void
  timing<T>(name: string, labels: Record<string, string>, fn: () => Promise<T>): Promise<T>

  // 自动注入 center 标签
  // counter('requests_total', 1, { method: 'POST' })
  // → 实际写入: center="capability", method="POST"
}
```

### 5.3 CenterHealth

```typescript
// 统一的 Health 接口。所有 Center 自动暴露 /health。
interface CenterHealth {
  registerCheck(name: string, check: () => Promise<{ status: 'ok' | 'error'; latency: number }>): void
  getStatus(): Promise<HealthResult>
  setDependencyStatus(centerName: string, status: 'ok' | 'degraded' | 'down'): void

  // SDK 自动注册以下检查：
  // - database: 数据库连接检查
  // - event_bus: Event Bus 连接检查
  // - cache: 缓存连接检查（如配置）
}

interface HealthResult {
  status: 'healthy' | 'degraded' | 'down'
  checks: Record<string, { status: string; latency: number }>
  dependencies: Record<string, string>
  version: string
  uptime: number
}
```

### 5.4 CenterEventBus

```typescript
// 统一的 Event Bus 接口。
interface CenterEventBus {
  // 发布事件
  publish(eventName: string, payload: Record<string, any>, options?: {
    traceId?: string
    spanId?: string
    idempotencyKey?: string
    delayMs?: number
  }): Promise<void>

  // 订阅事件
  subscribe(eventName: string, handler: (event: CenterEvent) => Promise<void>, options?: {
    consumerGroup?: string
    prefetchCount?: number
  }): void

  // 批量订阅（同一个 handler）
  subscribeMany(eventNames: string[], handler: (event: CenterEvent) => Promise<void>): void

  // 声明事件（用于文档生成）
  declareEvent(eventName: string, schema: Record<string, any>): void
}

interface CenterEvent {
  id: string
  name: string
  source: string
  traceId: string
  spanId: string
  payload: Record<string, any>
  timestamp: Date
  receivedAt: Date
}

// 事件命名规则（SDK 强制校验）:
// {source}.{action}.{version}
// e.g. "capability.resolved.v1", "execution.completed.v1"
// 违反命名规则的事件发布时 SDk 会抛出异常
```

### 5.5 CenterRepository

```typescript
// 统一的 Repository 基类。
abstract class CenterRepository<T> {
  protected db: Database
  protected cache: Cache

  abstract tableName: string
  abstract primaryKey: string

  async findById(id: string): Promise<T | null>
  async find(filter: Partial<T>): Promise<T[]>
  async create(data: T): Promise<T>
  async update(id: string, data: Partial<T>): Promise<T>
  async delete(id: string): Promise<void>
  async exists(id: string): Promise<boolean>

  // SDK 自动提供的监控
  protected queryLatency: Histogram  // repository_query_latency_ms
  protected queryCount: Counter      // repository_query_total
}
```

### 5.6 CenterErrors

```typescript
// 统一错误处理。
enum ErrorCode {
  // 全局
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT = 'CONFLICT',

  // 权限
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // 限流
  RATE_LIMITED = 'RATE_LIMITED',

  // 依赖
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',

  // Center 自定义（预留 1000-9999）
  CENTER_SPECIFIC = 1000,
}

class CenterError extends Error {
  constructor(
    public code: ErrorCode | string,
    message: string,
    public statusCode: number = 500,
    public detail?: string,
    public traceId?: string
  ) {
    super(message)
  }

  toResponse(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        detail: this.detail,
      },
      traceId: this.traceId || '',
    }
  }
}

// 所有 Center 的 Controller 必须使用 center.wrapResponse() 包裹响应
// SDK 自动处理：
// - 成功响应 → 200 + 统一格式
// - 错误响应 → 对应 HTTP 状态码 + 统一格式
// - 未捕获异常 → 500 + 统一格式 + 日志记录
```

---

## 6. 基础事件契约

所有 Center 必须发布以下 5 个基础事件：

| Event | Payload | 触发时机 |
|-------|---------|----------|
| `{center}.started.v1` | `{version, registries: string[]}` | Center 启动时 |
| `{center}.stopped.v1` | `{uptime: number}` | Center 停止时 |
| `{center}.health_changed.v1` | `{from: string, to: string, reason?: string}` | Health 状态变更时 |
| `{center}.error.v1` | `{errorCode, message, traceId}` | 发生未捕获异常时 |
| `{center}.metrics.v1` | `{metricCount: number}` | 定期（每分钟）Metrics 摘要 |

---

## 7. 统一 DTO

### 7.1 请求格式（所有 Center 统一通过 Gateway）

```typescript
interface CenterRequest {
  params: Record<string, any>         // path + query + body 统一在 params 中
  context: {
    workspaceId: string
    userId: string
    tier: string
    traceId: string
  }
}
```

### 7.2 响应格式

```typescript
interface CenterResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    detail?: string
  }
  traceId: string
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
  meta: {
    latency: number
    timestamp: string
    version: string
  }
}
```

---

## 8. Center 生命周期

```
INITIALIZED → STARTING → HEALTHY → STOPPING → STOPPED
                │            │
                │            ├── DEGRADED → HEALTHY
                │            └── DOWN → HEALTHY
                │
                └── FAILED → STOPPED
```

| 状态 | 含义 |
|------|------|
| INITIALIZED | Center 已创建，未启动 |
| STARTING | 正在加载配置、连接数据库、连接 Event Bus |
| HEALTHY | 正常运行 |
| DEGRADED | 部分依赖不可用，可降级运行 |
| DOWN | 关键依赖不可用 |
| STOPPING | 正在关闭连接 |
| STOPPED | 已完全停止 |
| FAILED | 启动失败 |

### 8.1 启动序列

```
Center 启动时 SDK 自动执行:
  1. 加载配置
  2. 连接数据库（如配置）
  3. 连接缓存（如配置）
  4. 连接 Event Bus
  5. 注册事件订阅
  6. 初始化 Registries
  7. 发布 {center}.started.v1
  8. 注册到 Gateway
  9. 打开 HTTP Listener
```

### 8.2 停止序列

```
Center 停止时 SDK 自动执行:
  1. 关闭 HTTP Listener
  2. 注销 Gateway 注册
  3. 取消所有事件订阅
  4. 关闭 Event Bus 连接
  5. 关闭数据库连接池
  6. 关闭缓存连接
  7. 发布 {center}.stopped.v1
```

---

## 9. 健康检查协议

每个 Center 必须暴露以下健康检查端点（SDK 自动生成）：

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    database: { status: 'ok' | 'error', latency: number },
    cache: { status: 'ok' | 'error', latency: number },
    event_bus: { status: 'ok' | 'error', consumerLag: number },
    // Registry 可以注册自定义检查
  },
  dependencies: {
    identity: 'ok' | 'degraded' | 'down',
    // ...
  },
  version: '1.0.0',
  uptime: 123456,
  registries: ['CapabilityRegistry', 'ProfileRegistry']
}
```

---

## 10. 统一 Metrics

每个 Center 自动暴露以下基础 Metrics（SDK 自动注册）：

| Metric | Type | Description |
|--------|------|-------------|
| `{center}_requests_total` | Counter | 请求总数 |
| `{center}_request_latency_ms` | Histogram | 请求延迟 |
| `{center}_request_errors_total` | Counter | 错误请求数 |
| `{center}_health_status` | Gauge | 当前健康状态（1=healthy, 0=degraded/down）|
| `{center}_registry_count` | Gauge | Registry 数量 |
| `{center}_event_published_total` | Counter | 发布事件数 |
| `{center}_event_consumed_total` | Counter | 消费事件数 |
| `{center}_event_consumer_lag` | Gauge | 消费者延迟 |
| `{center}_db_connections_active` | Gauge | 活跃数据库连接数 |
| `{center}_db_query_latency_ms` | Histogram | 数据库查询延迟 |

---

## 11. 统一 SLO

每个 Center 默认必须满足以下最小 SLO（SDK 自动验证）：

| SLI | Standard Target | Premium Target |
|-----|----------------|---------------|
| Availability (per month) | 99.9% | 99.99% |
| Request latency P95 | < 200ms | < 100ms |
| Error rate (5xx) | < 0.5% | < 0.1% |
| Event consumption lag | < 1s | < 100ms |
| Database query P95 | < 50ms | < 20ms |

---

## 12. 代码生成

Center SDK 提供脚手架 CLI：

```bash
npx kmki create-center Billing

# 生成:
# billing-center/
# ├── src/
# │   ├── index.ts              ← createCenter() + start()
# │   ├── config.ts             ← 自动从环境变量加载配置
# │   ├── service/              ← Service 层
# │   │   └── invoice.service.ts
# │   ├── registry/             ← Registry 层
# │   │   └── invoice.registry.ts
# │   ├── repository/           ← Repository 层
# │   │   └── invoice.repository.ts
# │   ├── events/               ← Event 定义
# │   │   └── invoice.events.ts
# │   ├── dto/                  ← DTO 定义
# │   │   └── invoice.dto.ts
# │   ├── health.ts             ← 自动合并到 /health
# │   └── metrics.ts            ← 自动注册到 Prometheus
# ├── test/
# │   ├── unit/
# │   └── integration/
# ├── openapi.yaml              ← 自动生成
# ├── README.md                 ← 自动生成（包含事件、API、SLO、依赖）
# ├── package.json
# └── tsconfig.json
```

---

## 13. 注册到 Developer Center

所有 Center 启动时必须自动注册到 Developer Center：

```typescript
// SDK 在 center.start() 时自动调用
developerCenter.register({
  name: 'capability',
  version: '1.0.0',
  health: 'https://capability-center/health',
  openapi: '/openapi.yaml',
  events: {
    publishes: ['capability.registered.v1', 'capability.deprecated.v1'],
    subscribes: ['provider.registered.v1', 'model.registered.v1']
  },
  dependencies: ['identity', 'ai'],
  owner: 'capability-team',
  lifecycle: 'stable'
})
```

---

## 14. Center SDK 版本与兼容性

| SDK 版本 | 支持的 Center Spec | 依赖 Constitution |
|----------|-------------------|-------------------|
| v1.0.x | v1.0 | v1.0–v1.1 |
| v1.1.x | v1.0–v1.1 | v1.0–v1.1 |

- 向后兼容承诺：Major 版本内不破坏 API
- 废弃周期：Minor 版本标记废弃后 3 个月方可移除
- 所有 Center 必须锁定 SDK Major 版本

---

> **Center SDK 不是「工具」。它是请自平台的设计约束。禁止绕过。**
