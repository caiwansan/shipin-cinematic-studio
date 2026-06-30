# KMKI Platform — Gateway Center Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-009 (统一 Response Schema), CONST-010 (所有 API 必须认证), CONST-022 (Event-first), CONST-023 (公共契约生命周期)  
> **ADR Alignment**: ADR-011 (Gateway single entry point)  
> **Blueprint Alignment**: Ch 2 (Gateway Architecture)  
> **Dependencies**: Identity Center (Auth), Observability Center (Metrics, Trace)  
> **Error Cascade Direction**: Gateway failure → entire platform unreachable  
> **Global Rule**: 所有 Center 的内部架构必须遵循 `Gateway → Service → Registry → Repository → DAO` 分层模式，禁止 `Gateway → DAO` 或 `Center → Database` 的直接调用。

---

## 1. Mission

平台唯一入口。所有外部请求（来自 Browser / Workspace Adapter / CLI / SDK）必须经过 Gateway。Gateway 负责认证、授权、限流、路由、Trace 注入、请求/响应标准化。不做业务逻辑。

## 2. Non-Responsibility

- 不包含任何业务逻辑
- 不调用 Provider
- 不存储业务数据
- 不管理 Center 配置
- 不执行 AI 调用

## 3. Core Data Model

### 3.1 Request 结构

```typescript
interface GatewayRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string                    // "/api/capability/resolve"
  headers: {
    authorization?: string        // "Bearer {token}"
    'x-trace-id'?: string
    'x-idempotency-key'?: string
    'content-type': string
  }
  params: Record<string, any>    // query + body 合并
  query: Record<string, string>
  body?: any
}
```

### 3.2 Response 结构（统一）

```typescript
interface GatewayResponse {
  success: boolean
  data?: any
  error?: {
    code: string                  // "AUTH_FAILED" | "RATE_LIMITED" | ...
    message: string
    detail?: string
  }
  message: string
  traceId: string
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
  meta?: {
    latency: number               // 毫秒
    timestamp: string
    version: string
  }
}
```

### 3.3 Route

```typescript
interface Route {
  method: string
  path: string                    // "/api/:center/:action"
  center: string                  // 路由到的 Center
  auth: boolean                   // 是否需要认证
  rateLimitKey?: string           // 限流 Key（如租户 ID）
  timeout: number                 // 毫秒
  middleware: string[]            // 应用的中间件
  version: string                 // semver
  lifecycle: 'experimental' | 'preview' | 'stable' | 'deprecated' | 'removed'
  deprecatedAt?: Date
  removedAt?: Date
}
```

### 3.4 AuthContext（经过认证后注入）

```typescript
interface AuthContext {
  userId: string
  workspaceId: string
  tier: 'free' | 'standard' | 'premium'
  permissions: string[]
  tokenType: 'user' | 'api_key' | 'service'
  tokenId: string
  expiresAt: Date
}
```

### 3.5 RateLimitBucket

```typescript
interface RateLimitBucket {
  key: string                     // 限流 Key
  tokens: number                  // 当前 Token 数
  capacity: number                // 容量上限
  fillRate: number                // 每秒补充数
  lastRefill: Date
}
```

---

## 4. Core Modules

### 4.1 Router

**Responsibility**: URL 路由、版本匹配、Center 分发。

```
Router
  ├── registerRoute(route: Route) → void
  ├── match(method, path) → { route, params }
  ├── listRoutes(filter?) → Route[]
  ├── deprecateRoute(path, deprecateAt) → void
  └── removeRoute(path) → void
```

**路由规则**:
```
/api/{center}/{action}/{resource?}
         │        │          │
         ▼        ▼          ▼
    "capability" "resolve"  (optional)

路由匹配顺序（最长前缀优先）:
  /api/runtime/session/:id/result → Runtime Session
  /api/runtime/session/:id       → Runtime Session
  /api/runtime/*                 → Runtime Center
```

### 4.2 Middleware Chain

**Responsibility**: 请求预处理链。所有中间件顺序执行，任何一个失败则终止。

```
Middleware Chain Order:
  │
  1. Trace Injection
  2. Authentication
  3. Authorization
  4. Rate Limiting
  5. Request Validation
  6. Idempotency
  7. Audit
```

#### 4.2.1 Trace Injection

```
Input: 原始 Request
  │
  ▼ 如果 header 中已有 X-Trace-Id → 透传
  │  否则生成新 Trace ID
  │  格式: "kmki-{timestamp}-{random8char}"
  │
  ▼ 初始化 Root Span
  │  parentSpanId = null
  │  spanId = generateSpanId()
  │
  ▼ 注入到 Request Context
  │
  ▼ 传入下游中间件
```

#### 4.2.2 Authentication

```
Input: Request + AuthContext (empty)
  │
  ▼ 提取 Authorization Header
  │  "Bearer {token}" 或 "ApiKey {key}"
  │
  ▼ 调用 Identity Center 验证 Token:
  │  POST /api/identity/auth/verify
  │  → {valid, userId, workspaceId, tier, permissions, expiresAt}
  │
  ▼ 如果无效 → 返回 401
  │
  ▼ 注入 AuthContext
  │
  ▼ 传入下游中间件
```

#### 4.2.3 Authorization

```
Input: AuthContext + Route
  │
  ▼ 检查 Route.auth
  │  false → 跳过
  │
  ▼ 检查 AuthContext.permissions 是否包含路由所需权限
  │
  ▼ 检查 AuthContext.tier 是否满足路由 tier 要求
  │
  ▼ 不满足 → 返回 403
  │
  ▼ 传入下游中间件
```

#### 4.2.4 Rate Limiting

```
Input: AuthContext
  │
  ▼ 确定限流 Key:
  │  workspaceId / userId / apiKey / IP
  │
  ▼ 获取 RateLimitBucket
  │  不存在 → 创建新 bucket
  │
  ▼ 执行 Token Bucket 算法:
  │  fill(bucket)  // 补充 Token
  │  if bucket.tokens <= 0 → 返回 429
  │  bucket.tokens--
  │
  ▼ 传入下游中间件
```

#### 4.2.5 Request Validation

```
Input: Request + Route
  │
  ▼ 校验必需字段（Content-Type 等）
  │
  ▼ 校验请求体大小（超过配置 limit → 413）
  │
  ▼ 校验参数类型（Schema 校验）
  │
  ▼ 不符合 → 返回 400
  │
  ▼ 传入下游中间件
```

#### 4.2.6 Idempotency

```
Input: Request (带 X-Idempotency-Key)
  │
  ▼ 仅对 POST/PUT/PATCH 生效
  │
  ▼ 如果无 Idempotency Key → 跳过
  │
  ▼ 查询缓存（Key → Response）
  │  命中 → 返回已缓存的 Response（保证幂等）
  │  未命中 → 传入下游中间件
  │           → 返回后缓存 Response
  │
  ▼ 缓存 TTL: 24 小时
```

#### 4.2.7 Audit

```
Input: AuthContext + Request + Response
  │
  ▼ 异步记录审计事件:
  │  { traceId, userId, workspaceId, method, path,
  │    statusCode, latency, timestamp }
  │
  ▼ 发布 audit.recorded.v1 事件
  │
  ▼ 传入 Controller / 返回响应
```

### 4.3 Controller

**Responsibility**: 参数解析、调用 Service、标准化响应。

```
Controller
  ├── extractParams(request, route) → Params
  ├── invokeCenter(center, action, params, authContext) → Promise<CenterResponse>
  ├── formatSuccess(data, pagination?) → GatewayResponse
  ├── formatError(code, message, statusCode) → GatewayResponse
  └── normalizeStreamChunk(chunk) → string    # SSE 流式响应
```

### 4.4 Service

**Responsibility**: 请求 Center 的地址解析、负载均衡、Service Discovery、健康检查。

```
Service
  ├── resolveCenterEndpoint(center) → { host, port, healthy }
  ├── callCenter(endpoint, action, params, authContext) → CenterResponse
  ├── loadBalance(center) → endpoint          # 轮询 / 最少连接
  ├── checkCenterHealth(center) → boolean
  └── getAllCenterStatus() → CenterHealth[]
```

### 4.5 Repository

**Responsibility**: 路由表持久化、限流 Bucket 持久化、Idempotency Cache。

```
Repository
  ├── RouteRepository: route CRUD
  ├── RateLimitRepository: bucket 读写 (Redis)
  └── IdempotencyRepository: cache 读写 (Redis, TTL 24h)
```

---

## 5. Routes Table

| Method | Path | Center | Auth | Rate Limit | Version |
|--------|------|--------|------|------------|---------|
| POST | `/api/identity/auth` | Identity | No | global | v1 |
| POST | `/api/identity/token/refresh` | Identity | Yes | user | v1 |
| GET | `/api/ai/providers` | AI | Yes | user | v1 |
| GET | `/api/ai/models` | AI | Yes | user | v1 |
| GET | `/api/ai/models/:id/profile` | AI | Yes | user | v1 |
| POST | `/api/capability/resolve` | Capability | Yes | workspace | v1 |
| GET | `/api/capability` | Capability | Yes | user | v1 |
| POST | `/api/runtime/execute` | Runtime | Yes | workspace | v1 |
| GET | `/api/runtime/session/:id` | Runtime | Yes | user | v1 |
| GET | `/api/runtime/session/:id/result` | Runtime | Yes | user | v1 |
| POST | `/api/runtime/session/:id/cancel` | Runtime | Yes | user | v1 |
| GET | `/api/runtime/artifacts/:id` | Runtime | Yes | user | v1 |
| GET | `/api/runtime/artifacts/:id/data` | Runtime | Yes | user | v1 |
| POST | `/api/asset/upload` | Asset | Yes | user | v1 |
| GET | `/api/asset/:id` | Asset | Yes | user | v1 |
| GET | `/api/developer/docs` | Developer | No | global | v1 |

---

## 6. Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Gateway Service                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              HTTP Listener (Nginx / Envoy)               │ │
│  │  TLS Termination | Load Balance | Static File Serving   │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────────────────┐│
│  │              Router                                       ││
│  │  match(method, path) → {center, action, params}          ││
│  └──────────────────────┬───────────────────────────────────┘│
│                         │                                    │
│  ┌──────────────────────┴─────────────────────────────────┐  │
│  │              Middleware Chain（顺序执行）                  │  │
│  │                                                         │  │
│  │  1. Trace Injection  2. Authentication  3. Authorization │  │
│  │  4. Rate Limiting   5. Validation     6. Idempotency     │  │
│  │  7. Audit                                               │  │
│  └──────────────────────┬──────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │              Controller                                  │ │
│  │  extractParams → call Service → formatResponse           │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │              Service                                     │ │
│  │  Service Discovery | Load Balance | Health Check        │ │
│  │  Center Proxy | Stream Proxy (SSE/WebSocket)            │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │              Repository                                  │ │
│  │  RouteRepository | RateLimitRepository (Redis)          │ │
│  │  IdempotencyRepository (Redis) | TokenBlacklist (Redis) │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                  │                   │
         ▼                  ▼                   ▼
   Identity Center     Capability Center    Runtime Center
   (Auth verify)       (业务路由)            (执行路由)
```

---

## 7. Public Contract

### 7.1 统一请求格式（Gateway 对外）

```json
// POST /api/capability/resolve
{
  "params": {
    "capabilityId": "reason.generate",
    "version": 3
  },
  "context": {
    "workspaceId": "brand-geo",
    "userId": "u_abc123"
  }
}
```

### 7.2 统一响应格式

```json
{
  "success": true,
  "data": { ... },
  "message": "",
  "traceId": "kmki-20260720-a1b2c3d4",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 156
  },
  "meta": {
    "latency": 342,
    "timestamp": "2026-07-20T12:00:00Z",
    "version": "1.0.0"
  }
}
```

### 7.3 错误统一格式

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 5 seconds.",
    "detail": "Rate limit exceeded for workspace brand-geo on path /api/capability/resolve"
  },
  "message": "Request throttled",
  "traceId": "kmki-20260720-a1b2c3d4"
}
```

### 7.4 HTTP 状态码

| Code | 含义 | 适用场景 |
|------|------|----------|
| 200 | 成功 | 正常返回 |
| 400 | 参数校验失败 | Validation Middleware |
| 401 | 认证失败 | Authentication Middleware |
| 403 | 权限不足 | Authorization Middleware |
| 404 | 路由/资源不存在 | Router |
| 409 | 冲突 | Idempotency Middleware |
| 413 | 请求体过大 | Validation Middleware |
| 429 | 限流 | Rate Limiting Middleware |
| 500 | 服务端错误 | Controller / Service |
| 503 | 服务不可用 | Service (下游 Center 离线) |
| 504 | 超时 | Service (下游 Center 超时) |

### 7.5 SSE 流式响应格式

```text
event: execution.node.completed
data: {"nodeId": "node_llm", "status": "running", "chunk": "..."}

event: execution.completed
data: {"sessionId": "ses_abc", "status": "completed", "cost": 0.0032}
```

### 7.6 WebSocket 连接

```
ws://gateway/api/runtime/stream/{sessionId}
→ 实时推送 execution.node.started / completed / failed 事件
```

---

## 8. Events

Gateway 发布（Publisher）：

| Event | Payload | Guarantee | Subscriber |
|-------|---------|-----------|------------|
| `gateway.request.started.v1` | `{traceId, method, path, userId, workspaceId}` | At Least Once | Observability |
| `gateway.request.completed.v1` | `{traceId, statusCode, latency, method, path}` | At Least Once | Observability |
| `gateway.rate_limit.hit.v1` | `{key, path, limit}` | At Most Once | Observability |
| `gateway.auth.failed.v1` | `{token, reason}` | At Most Once | Observability, Identity |

Gateway 订阅（Subscriber）：

| Event | Handler |
|-------|---------|
| `identity.token_revoked.v1` | 将 Token 加入黑名单缓存 |

---

## 9. Stream Flow (SSE)

```
Client → HTTP POST /api/runtime/execute { stream: true }
  │
  ▼ Gateway 接收请求
  │   注入 Trace ID
  │   执行 Middleware Chain
  │
  ▼ Controller 识别 stream: true
  │   设置 Response Header: Content-Type: text/event-stream
  │   flush headers immediately
  │
  ▼ Service 调用 Runtime Center
  │   HTTP POST /api/runtime/execute (stream=true)
  │   → Runtime 返回 SSE Stream
  │
  ▼ Gateway 逐 chunk 透传到 Client
  │   chunk → normalize → write to response
  │
  ▼ 完成后关闭连接
```

## 10. Failure Mode

| 场景 | 行为 |
|------|------|
| Identity Center 不可用 | 拒绝所有需要认证的请求，返回 503 |
| 下游 Center 不可用 | 返回 503 Service Unavailable + 指明哪个 Center 不可用 |
| Rate Limit Store 不可用 | 降级为本地计数器（in-memory Token Bucket，有误差）|
| Gateway 过载 | 返回 429 并进入 Connection Backlog |
| 请求体超过限制 | 返回 413 Payload Too Large |
| 无效路由 | 返回 404 Route Not Found |
| WebSocket 断开 | 客户端自动重连 |

---

## 11. Recovery

| 场景 | 恢复步骤 |
|------|---------|
| Identity Center 恢复 | Gateway 自动重试认证调用，恢复后正常处理 |
| Rate Limit Store 恢复 | 从 Redis 重新加载计数器 |
| Gateway 进程重启 | 路由表从 Repository 重新加载，Rate Limit 从 Redis 恢复 |
| 连接泄漏 | 监控活跃连接数，超过阈值自动关闭闲置连接 |

---

## 12. Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `gateway_requests_total` | Counter | method, path, status | 总请求数 |
| `gateway_request_latency_ms` | Histogram | method, path | 请求延迟 |
| `gateway_active_connections` | Gauge | — | 活跃连接数 |
| `gateway_requests_rate_limited` | Counter | path | 限流请求数 |
| `gateway_requests_auth_failed` | Counter | reason | 认证失败次数 |
| `gateway_requests_validation_failed` | Counter | path | 参数校验失败 |
| `gateway_upstream_latency_ms` | Histogram | center | 下游 Center 响应延迟 |
| `gateway_upstream_errors` | Counter | center, status | 下游 Center 错误 |
| `gateway_sse_connections` | Gauge | — | SSE 连接数 |
| `gateway_ws_connections` | Gauge | — | WebSocket 连接数 |

---

## 13. Health Endpoint

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    rate_limit_store: { status: 'ok' | 'error', latency: number },
    idempotency_cache: { status: 'ok' | 'error', latency: number }
  },
  downstream: {
    identity: { status: 'ok' | 'degraded' | 'down', latency: number },
    ai_center: { status: 'ok' | 'degraded' | 'down', latency: number },
    capability_center: { status: 'ok' | 'degraded' | 'down', latency: number },
    runtime_center: { status: 'ok' | 'degraded' | 'down', latency: number },
    asset_center: { status: 'ok' | 'degraded' | 'down', latency: number },
    developer_center: { status: 'ok' | 'degraded' | 'down', latency: number }
  },
  connections: {
    active: number,
    max: number,
    sse: number,
    websocket: number
  }
}
```

---

## 14. SLO

| SLI | Target |
|-----|--------|
| Request latency (p99, no downstream) | < 5ms |
| Request latency (p99, with downstream) | — (取决于下游 Center) |
| Middleware chain latency P99 | < 2ms |
| Rate Limit check latency P99 | < 1ms |
| Auth verify latency P99 | < 50ms |
| SSE chunk relay latency P99 | < 5ms |
| Availability (per month) | 99.99% |
| Error rate (5xx) | < 0.1% |

---

## 15. Platform 统一架构规范

所有 Center 的内部架构必须遵循以下分层模式，禁止跨层调用：

```
Layer 0:  Gateway (唯一入口)
              │  HTTP/SSE/WebSocket
              ▼
Layer 1:  Service (业务编排/路由/负载均衡)
              │  通过 Registry 访问数据
              ▼
Layer 2:  Registry (业务能力注册/查询)
              │  通过 Repository 访问数据
              ▼
Layer 3:  Repository (数据访问/持久化)
              │  DAO 实现
              ▼
Layer 4:  DAO / Database
```

**禁止规则**:
- ❌ `Gateway → DAO` — Gateway 不直接访问数据库
- ❌ `Service → Database` — Service 不直接访问数据库
- ❌ `Registry → Provider SDK` — Registry 不直接调用 Provider
- ❌ `Center → Database` — Center 间不通过数据库共享数据
- ❌ `Gateway → Provider` — Gateway 不调用 AI Provider

**允许规则**:
- ✅ `Gateway → Service → Registry` — 标准调用链
- ✅ `Service → Multiple Registries` — 一个 Service 可以调用多个 Registry
- ✅ `Registry → Repository → DAO` — Registry 通过 Repository 访问数据
- ✅ `Gateway → Center Service (HTTP)` — Gateway 通过 HTTP 调用下游 Center

---

> **Gateway is the single door. Every byte enters through it. Every response leaves through it. Centers never expose ports directly.**
