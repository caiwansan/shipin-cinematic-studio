# KMKI Platform — Developer Center Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-001–CONST-029  
> **ADR Alignment**: ADR-001–ADR-020  
> **Layers**: Constitution → Blueprint → ADR → Center SDK → Center Template → **Developer Center**  
> **Mission**: Developer Center is the single platform interface for external developers. All external interactions (SDK, CLI, API Keys, Webhook, OpenAPI, Playground, Plugin, Template) go through Developer Center. Not a business Center — it's the Platform Interface Layer.  
> **Dependencies**: All 7 Centers (for OpenAPI schema generation), Identity Center (for API Key auth)  
> **Error Cascade Direction**: Developer Center failure → developers cannot create API keys, download SDKs, or access docs. Existing integrations continue to work.

---

## 1. Mission

Developer Center is the single platform interface for external developers. External developers never touch Gateway directly — they touch Developer Center, which provides SDKs, CLI, API Keys, Webhooks, Documentation, Playground, Plugin Registry, and Starter Templates.

Developer Center does not contain business logic. It does not execute AI calls. It does not manage Provider configurations. It is purely a Platform Interface Layer.

## 2. Non-Responsibility

- 不执行业务逻辑
- 不调用 Provider
- 不管理 AI Center Registry
- 不管理 Asset 业务数据
- 不修改 Capability / Runtime / Identity 状态
- 不在 Runtime 中执行任何代码

---

## 3. Core Data Models

### 3.1 ER Diagram

```
ApiKey (1) ──── (N) ApiKeyScope
       │
       ├── (N) SdkRelease
       ├── (N) CliRelease
       ├── (N) WebhookEndpoint
       ├── (N) PluginManifest
       ├── (N) Template
       ├── (N) Documentation
       ├── (N) ApiProduct
       └── (N) OpenApiSpec
```

### 3.2 ApiKey

```typescript
interface ApiKey {
  id: string
  name: string                    // 开发者给 Key 的命名
  key: string                     // 实际密钥（前缀 + hash 后存储）
  prefix: string                  // "kmki_sk_" — 用于识别 Key 类型
  type: 'secret' | 'publishable'
  workspaceId: string
  userId: string
  scopes: ApiKeyScope[]
  status: 'active' | 'revoked' | 'expired'
  expiresAt?: Date
  lastUsedAt?: Date
  rateLimit: {
    tier: 'free' | 'standard' | 'premium'
    maxRPM: number                // 每分钟最大请求数
    maxRPD: number                // 每日最大请求数
  }
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

interface ApiKeyScope {
  resource: string                // "capability.resolve" | "runtime.execute"
  access: 'read' | 'write' | 'admin'
  restrictions?: {
    models?: string[]             // 允许的模型
    maxBudget?: number            // 美元
    allowedIps?: string[]
  }
}
```

### 3.3 SdkRelease

```typescript
interface SdkRelease {
  id: string
  language: 'typescript' | 'python' | 'go' | 'java' | 'rust' | 'php'
  version: string                 // "1.2.3"
  packageName: string             // "@kmki/platform-sdk"
  minSdkVersion?: string          // 兼容的最低 SDK 版本
  compatibility: {
    apiVersion: string            // "v1"
    centers: string[]             // 支持的 Center 列表
  }
  releaseNotes: string
  checksum: string                // SHA-256
  downloadUrl: string             // CDN 下载链接
  npmPackage?: string             // "npm install @kmki/platform-sdk"
  pipPackage?: string             // "pip install kmki-sdk"
  publishedAt: Date
  lifecycle: 'stable' | 'beta' | 'deprecated'
}
```

### 3.4 CliRelease

```typescript
interface CliRelease {
  id: string
  version: string
  platforms: {
    linux: CliBinary
    macos: CliBinary
    windows: CliBinary
    docker: string               // docker image tag
  }
  releaseNotes: string
  checksum: string
  publishedAt: Date
  lifecycle: 'stable' | 'beta' | 'deprecated'
}

interface CliBinary {
  arch: 'x64' | 'arm64'
  downloadUrl: string
  checksum: string
}
```

### 3.5 WebhookEndpoint

```typescript
interface WebhookEndpoint {
  id: string
  workspaceId: string
  userId: string
  url: string                     // 回调 URL
  secret: string                  // HMAC 签名密钥（hash 存储）
  events: string[]                // 订阅的事件列表
  status: 'active' | 'disabled' | 'failed'
  filters?: {
    centers?: string[]            // 只接收指定 Center 的事件
    severity?: string[]           // 只接收指定级别
  }
  retryPolicy: {
    maxRetries: number
    backoff: 'linear' | 'exponential'
    timeout: number
  }
  deliveryStats: {
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
    lastDeliveryAt?: Date
    lastFailureReason?: string
  }
  createdAt: Date
}
```

### 3.6 PluginManifest

```typescript
interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  type: 'connector' | 'extension' | 'ui_plugin' | 'middleware'
  homepage: string
  license: string
  hooks: string[]                 // 插件将要接入的 Center 扩展点
  permissions: string[]           // 插件请求的权限
  runtime: {
    language: string
    entrypoint: string            // 入口文件（相对于插件根目录）
    env: Record<string, string>   // 环境变量列表
  }
  checksum: string
  downloadUrl: string
  publishedAt: Date
  lifecycle: 'experimental' | 'preview' | 'stable' | 'deprecated'
}
```

### 3.7 Template

```typescript
interface Template {
  id: string
  name: string
  description: string
  category: 'starter' | 'example' | 'tutorial'
  targets: string[]               // ["geo-workspace", "capability-plugin"]
  files: TemplateFile[]
  tags: string[]
  downloadUrl: string
  publishedAt: Date
}

interface TemplateFile {
  path: string
  content: string                 // 模板内容（含变量占位符）
  type: 'code' | 'config' | 'docs'
}
```

### 3.8 Documentation

```typescript
interface Documentation {
  id: string
  slug: string                    // "getting-started/quickstart"
  title: string
  content: string                 // Markdown
  category: 'guide' | 'reference' | 'tutorial' | 'changelog' | 'faq'
  tags: string[]
  order: number
  published: boolean
  version: string                 // 对应平台版本
  updatedAt: Date
}
```

### 3.9 ApiProduct

```typescript
interface ApiProduct {
  id: string
  name: string                    // "Starter", "Professional", "Enterprise"
  description: string
  tier: 'free' | 'standard' | 'premium'
  features: string[]
  rateLimits: {
    maxRPM: number
    maxRPD: number
    maxConcurrency: number
  }
  allowedCapabilities: string[]   // 可访问的 Capability
  maxApiKeys: number
  maxWebhooks: number
  price: {
    monthly: number               // 美元
    annual: number                // 美元
  }
  published: boolean
}
```

### 3.10 OpenApiSpec

```typescript
interface OpenApiSpec {
  id: string
  spec: Record<string, any>       // 完整的 OpenAPI 3.1 规范
  generatedFrom: string[]         // 来源 Center 列表
  version: string                 // "1.0.0"
  generatedAt: Date
  validated: boolean
}
```

---

## 4. Core Modules (10 + 3 Registries)

### 4.1 API Key Registry

**Responsibility**: API Key 的完整生命周期管理。

```
APIKeyRegistry
  ├── createKey(workspaceId, userId, scopes, tier) → ApiKey
  ├── getKey(id) → ApiKey
  ├── validateKey(key) → { valid, apiKey, error }
  ├── revokeKey(id) → void
  ├── listKeys(workspaceId) → ApiKey[]
  ├── getUsageStats(id) → { lastHour, lastDay, total }
  └── rotateKey(id) → ApiKey
```

### 4.2 SDK Registry

**Responsibility**: 多语言 SDK 的版本管理。

```
SDKRegistry
  ├── publishRelease(release) → SdkRelease
  ├── getLatestRelease(language) → SdkRelease
  ├── getRelease(language, version) → SdkRelease
  ├── listReleases(language) → SdkRelease[]
  ├── listLanguages() → string[]
  └── deprecateRelease(language, version) → void
```

### 4.3 CLI Registry

**Responsibility**: CLI 二进制发布管理。

```
CLIRegistry
  ├── publishRelease(release) → CliRelease
  ├── getLatestRelease() → CliRelease
  ├── getRelease(version) → CliRelease
  ├── listReleases() → CliRelease[]
  ├── getDownloadUrl(version, platform, arch) → string
  └── deprecateRelease(version) → void
```

### 4.4 Playground Registry

**Responsibility**: 在线调试 — API Explorer 请求的执行。

```
PlaygroundRegistry
  ├── createSession(userId, params) → PlaygroundSession
  ├── executeRequest(sessionId, request) → PlaygroundResponse
  ├── getHistory(userId) → PlaygroundSession[]
  ├── saveExample(sessionId, name) → void
  └── shareSession(sessionId) → { shareUrl }
```

### 4.5 OpenAPI Registry

**Responsibility**: OpenAPI 规范的自动生成、版本管理。

```
OpenAPIRegistry
  ├── generateSpec(center: string[]) → OpenApiSpec
  ├── getLatestSpec(version?) → OpenApiSpec
  ├── validateSpec(spec) → { valid, errors }
  ├── generateClient(language) → string     # 生成客户端代码
  └── listVersions() → string[]
```

**OpenAPI 生成规则**:
```
Developer Center 从以下源自动合并生成 OpenAPI 3.1 规范:
  1. 各 Center 注册的 Route（通过 Gateway 获取 Route 表）
  2. Center SDK 声明的 DTO Schema（request/response）
  3. 各 Center 的事件 Schema

生成策略:
  - 按 Center 分组: /api/{center}/{action}
  - 自动注入统一响应格式（GatewayResponse）
  - 自动注入认证方式（API Key 或 Bearer Token）
  - 自动注入错误码（ErrorResponse）
  - 随 Center 注册自动更新
```

### 4.6 Webhook Registry

**Responsibility**: Webhook Endpoint 管理、签名验证、重试、投递。

```
WebhookRegistry
  ├── registerEndpoint(endpoint) → WebhookEndpoint
  ├── updateEndpoint(id, updates) → void
  ├── deleteEndpoint(id) → void
  ├── getEndpoint(id) → WebhookEndpoint
  ├── listEndpoints(workspaceId) → WebhookEndpoint[]
  ├── dispatchEvent(event, targets) → { succeeded, failed }
  └── retryFailed(id, deliveryId) → void
```

**Webhook 投递流程**:
```
Event Bus 中的事件 → WebhookRegistry.dispatch()
  │
  ▼ 匹配订阅
  │  匹配 workspaceId + 事件名称 + 过滤器
  │
  ▼ 生成 Payload
  │  标准格式: { event, timestamp, data, signature }
  │  signature = HMAC-SHA256(secret, payload)
  │
  ▼ 发送 POST 请求
  │  timeout: 10s
  │
  ▼ 成功 → 标记 delivered
  │
  ▼ 失败 → 重试（指数退避, 最多 5 次）
  │
  ▼ 全部失败 → 标记 endpoint 为 failed
  │  发布 webhook.endpoint.failed.v1 事件
```

### 4.7 Documentation Registry

**Responsibility**: 文档管理。

```
DocumentationRegistry
  ├── createPage(page) → Documentation
  ├── updatePage(id, content) → void
  ├── deletePage(id) → void
  ├── getPage(slug) → Documentation
  ├── searchDocs(query) → Documentation[]
  └── listByCategory(category) → Documentation[]
```

### 4.8 Example Registry

**Responsibility**: 示例代码管理。

```
ExampleRegistry
  ├── createExample(example: Example) → void
  ├── listByLanguage(language) → Example[]
  ├── listByUseCase(useCase) → Example[]
  └── getById(id) → Example

interface Example {
  id: string
  title: string
  description: string
  language: string
  useCase: string               // "agent-creation" | "search" | "upload"
  code: string
  dependencies: string[]
  expectedOutput: string
}
```

### 4.9 Template Registry

**Responsibility**: Starter Template 管理。

```
TemplateRegistry
  ├── publishTemplate(template) → Template
  ├── getTemplate(id) → Template
  ├── listTemplates(category?) → Template[]
  ├── generateProject(templateId, variables) → zip
  └── deprecateTemplate(id) → void
```

### 4.10 Plugin Registry

**Responsibility**: Plugin Manifest 注册、下载。

```
PluginRegistry
  ├── registerPlugin(manifest) → PluginManifest
  ├── getPlugin(id) → PluginManifest
  ├── listPlugins(type?) → PluginManifest[]
  ├── installPlugin(workspaceId, pluginId) → void
  ├── uninstallPlugin(workspaceId, pluginId) → void
  ├── listInstalled(workspaceId) → PluginManifest[]
  └── deprecatePlugin(id) → void
```

### 4.11 API Product Registry（扩展）

**Responsibility**: API 产品套餐管理。

```
APIProductRegistry
  ├── createProduct(product) → ApiProduct
  ├── getProduct(id) → ApiProduct
  ├── listProducts() → ApiProduct[]
  ├── getProductForTier(tier) → ApiProduct
  └── updateProduct(id, product) → void
```

### 4.12 SDK Release Registry（扩展 Registry）

**Responsibility**: 多语言 SDK 的发布、版本追踪、下载。

```
SDKReleaseRegistry
  ├── registerRelease(language, version, artifacts) → void
  ├── getLatest(language) → { version, artifacts, compatibility }
  ├── listReleases(language) → { version, publishedAt, lifecycle }[]
  ├── getPackageName(language) → string
  └── getInstallCommand(language, version?) → string
```

### 4.13 OpenAPI Generator（扩展 — 不是一个 Registry，是一个模块）

**Responsibility**: 从所有 Center 注册的信息自动生成并对外提供 OpenAPI 规范、客户端 SDK、Postman 集合等。

```
OpenAPIGenerator
  ├── generateSpec(include: string[]) → OpenApiSpec     # 生成 OpenAPI 3.1
  ├── generateTypescriptClient(spec) → string            # 生成 TypeScript Client
  ├── generatePythonClient(spec) → string
  ├── generatePostmanCollection(spec) → string
  ├── generateRedocHtml(spec) → string
  └── diffSpecs(oldSpec, newSpec) → { added, removed, changed }
```

---

## 5. Public API

### 5.1 API Keys

```
POST   /api/developer/keys              → ApiKey          # 创建 Key
GET    /api/developer/keys              → ApiKey[]        # 列出 Keys
GET    /api/developer/keys/:id          → ApiKey          # 获取 Key 详情
DELETE /api/developer/keys/:id          → void            # 吊销 Key
POST   /api/developer/keys/:id/rotate   → ApiKey          # 轮换 Key
```

### 5.2 SDK

```
GET    /api/developer/sdks              → string[]        # 列出支持的语言
GET    /api/developer/sdks/:lang        → SdkRelease      # 最新版本
GET    /api/developer/sdks/:lang/versions → SdkRelease[]  # 版本列表
GET    /api/developer/sdks/:lang/download → binary        # 下载 SDK
```

### 5.3 CLI

```
GET    /api/developer/cli/latest        → CliRelease      # 最新 CLI 版本
GET    /api/developer/cli/versions      → CliRelease[]    # 版本列表
GET    /api/developer/cli/download/:platform/:arch → binary # 下载 CLI
```

### 5.4 Playground

```
POST   /api/developer/playground/session → PlaygroundSession
POST   /api/developer/playground/execute → PlaygroundResponse
GET    /api/developer/playground/history → PlaygroundSession[]
```

### 5.5 OpenAPI

```
GET    /api/developer/openapi           → OpenApiSpec     # 最新 OpenAPI Spec
GET    /api/developer/openapi/versions  → string[]        # 版本列表
GET    /api/developer/openapi/client/:lang → binary       # 生成客户端 SDK
GET    /api/developer/openapi/redoc     → HTML            # Redoc UI
GET    /api/developer/openapi/postman   → json            # Postman Collection
```

### 5.6 Webhooks

```
POST   /api/developer/webhooks          → WebhookEndpoint # 注册 Webhook
GET    /api/developer/webhooks          → WebhookEndpoint[] # 列表
GET    /api/developer/webhooks/:id      → WebhookEndpoint # 详情
PATCH  /api/developer/webhooks/:id      → WebhookEndpoint # 更新
DELETE /api/developer/webhooks/:id      → void            # 删除
POST   /api/developer/webhooks/:id/test → TestResult      # 测试投递
```

### 5.7 Plugin

```
POST   /api/developer/plugins           → PluginManifest  # 注册插件
GET    /api/developer/plugins           → PluginManifest[] # 列出插件
GET    /api/developer/plugins/:id       → PluginManifest  # 详情
POST   /api/developer/plugins/:id/install → void           # 安装到 Workspace
POST   /api/developer/plugins/:id/uninstall → void         # 卸载
```

### 5.8 Templates

```
GET    /api/developer/templates         → Template[]      # 模板列表
GET    /api/developer/templates/:id     → Template        # 模板详情
POST   /api/developer/templates/:id/generate → zip        # 生成项目
```

### 5.9 Documentation

```
GET    /api/developer/docs              → Documentation[] # 文档列表
GET    /api/developer/docs/:slug        → Documentation   # 文档内容
GET    /api/developer/docs/search       → Documentation[] # 搜索文档
```

### 5.10 API Products

```
GET    /api/developer/products          → ApiProduct[]   # 产品列表
GET    /api/developer/products/:id      → ApiProduct     # 产品详情
```

---

## 6. Events

Developer Center 发布（Publisher）：

| Event | Payload | Guarantee | Subscriber |
|-------|---------|-----------|------------|
| `developer.key.created.v1` | `{keyId, workspaceId, tier}` | At Least Once | Observability, Audit |
| `developer.key.revoked.v1` | `{keyId, workspaceId}` | At Least Once | Observability, Gateway (cache clear) |
| `developer.key.expired.v1` | `{keyId}` | At Least Once | Observability |
| `developer.webhook.registered.v1` | `{webhookId, workspaceId, events}` | At Least Once | Observability |
| `developer.webhook.delivered.v1` | `{webhookId, eventName, status}` | At Least Once | Observability |
| `developer.webhook.failed.v1` | `{webhookId, eventName, error, attempt}` | At Least Once | Observability |
| `developer.sdk.released.v1` | `{language, version}` | At Least Once | Observability |
| `developer.plugin.registered.v1` | `{pluginId, name, version}` | At Least Once | Observability |
| `developer.product.purchased.v1` | `{workspaceId, productId, tier}` | At Least Once | Billing Center |

Developer Center 订阅（Subscriber）：

| Event | Handler |
|-------|---------|
| `center.registered.v1` | 自动更新 OpenAPI 规范（新增路由）|
| `center.started.v1` | 自动更新 OpenAPI 规范 |
| `asset.storage.low.v1` | 通知 Webhook 订阅者 |
| `execution.completed.v1` | 可选：通过 Webhook 通知订阅者 |

---

## 7. Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Developer Center Service                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Public API Layer                             │ │
│  │  API Keys | SDK | CLI | Playground | OpenAPI             │ │
│  │  Webhook | Plugin | Template | Docs | Products           │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────────────┐   │
│  │              13 Registries                              │   │
│  │                                                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ API Key  │ │   SDK    │ │   CLI    │ │Playground│  │   │
│  │  │ Registry │ │ Registry │ │ Registry │ │ Registry │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ OpenAPI  │ │ Webhook  │ │Document  │ │ Example  │  │   │
│  │  │ Registry │ │ Registry │ │Registry   │ │ Registry │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Template │ │ Plugin   │ │API Prod  │ │ SDK Rel  │  │   │
│  │  │ Registry │ │ Registry │ │ Registry │ │ Registry │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────────────┐                                  │   │
│  │  │ OpenAPI Generator│                                  │   │
│  │  └──────────────────┘                                  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Repository Layer                             │ │
│  │  ApiKeyDAO | SdkDAO | CliDAO | WebhookDAO | PluginDAO    │ │
│  │  TemplateDAO | DocDAO | ProductDAO                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              OpenAPI Auto-Generator                       │ │
│  │  订阅 Center 注册事件 → 自动更新 OpenAPI 3.1 规范       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Public Contract

### 8.1 API Key Create

```json
POST /api/developer/keys
{
  "name": "Production Key",
  "type": "secret",
  "scopes": [
    { "resource": "capability.resolve", "access": "write" },
    { "resource": "runtime.execute", "access": "write" }
  ],
  "expiresIn": "365d"
}
→
{
  "success": true,
  "data": {
    "id": "key_a1b2c3d4",
    "name": "Production Key",
    "key": "kmki_sk_a1b2c3d4e5f6...",
    "prefix": "kmki_sk_",
    "type": "secret",
    "scopes": [
      { "resource": "capability.resolve", "access": "write" },
      { "resource": "runtime.execute", "access": "write" }
    ],
    "status": "active",
    "expiresAt": "2027-07-20T12:00:00Z"
  }
}
```

### 8.2 Webhook Test

```json
POST /api/developer/webhooks/wh_abc/test
→
{
  "success": true,
  "data": {
    "deliveryId": "del_001",
    "status": "delivered",
    "httpStatus": 200,
    "latency": 342,
    "payload": {
      "event": "execution.completed.v1",
      "data": { ... },
      "timestamp": "2026-07-20T12:00:00Z"
    }
  }
}
```

### 8.3 Error

```json
{
  "success": false,
  "error": {
    "code": "KEY_EXPIRED",
    "message": "API Key has expired",
    "detail": "Key key_a1b2c3d4 expired on 2026-06-20"
  },
  "traceId": "kmki-20260720-a1b2c3d4"
}
```

---

## 9. Failure Mode

| 场景 | 行为 |
|------|------|
| API Key Store 不可用 | 无法创建/验证 Key，但已有的 Key 可继续使用 |
| OpenAPI Generator 不可用 | 返回最后生成的缓存版本 |
| SDK 下载不可用 | 返回 CDN URL（不经过 Developer Center 代理）|
| Webhook 投递失败 | 重试策略；超过最大次数后标记 endpoint failed |
| Playground 不可用 | 返回降级提示，不影响生产环境 |
| 数据库不可用 | 只读模式下可查文档和模板 |

---

## 10. Recovery

| 场景 | 恢复步骤 |
|------|---------|
| API Key Store 恢复 | 重新加载 Key 缓存 → 恢复正常验证 |
| Webhook 重连 | 从失败队列重试最近 24 小时的失败投递 |
| OpenAPI 数据源同步 | 重新订阅所有 Center 事件 → 全量生成 |

---

## 11. API Endpoints Summary

| 模块 | API 数 | 说明 |
|------|:------:|------|
| API Keys | 5 | CRUD + Rotate |
| SDK | 4 | 列表 + 版本 + 下载 |
| CLI | 3 | 最新版本 + 列表 + 下载 |
| Playground | 3 | Session + 执行 + 历史 |
| OpenAPI | 5 | Spec + 版本 + Client + Redoc + Postman |
| Webhooks | 6 | CRUD + 测试 |
| Plugin | 6 | CRUD + 安装 + 卸载 |
| Templates | 3 | 列表 + 详情 + 生成 |
| Documentation | 3 | 列表 + 内容 + 搜索 |
| API Products | 2 | 列表 + 详情 |

---

## 12. Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `developer_keys_active` | Gauge | tier | 活跃 Key 数 |
| `developer_keys_created` | Counter | tier | Key 创建数 |
| `developer_keys_revoked` | Counter | — | Key 吊销数 |
| `developer_webhook_deliveries` | Counter | status | Webhook 投递数 |
| `developer_webhook_failures` | Counter | — | Webhook 失败数 |
| `developer_sdk_downloads` | Counter | language | SDK 下载数 |
| `developer_cli_downloads` | Counter | platform | CLI 下载数 |
| `developer_playground_sessions` | Counter | — | Playground 会话数 |
| `developer_openapi_generations` | Counter | — | OpenAPI 生成次数 |

---

## 13. Health Endpoint

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    database: { status: 'ok' | 'error', latency: number },
    openapi_generator: { status: 'ok' | 'error', lastGeneration: Date },
    webhook_worker: { status: 'ok' | 'error' },
    key_cache: { status: 'ok' | 'error' }
  },
  stats: {
    activeKeys: number,
    activeWebhooks: number,
    sdkLanguages: number,
    pluginsRegistered: number
  }
}
```

---

## 14. SLO

| SLI | Target |
|-----|--------|
| API Key creation latency P95 | < 200ms |
| API Key validation latency P95 | < 10ms |
| Webhook dispatch latency P95 | < 500ms |
| OpenAPI generation latency P99 | < 5s |
| SDK download latency (CDN) | < 100ms |
| Playground execution latency | — (取决于下游 Center) |
| Availability (per month) | 99.95% |

---

## 15. Integration — Platform Interface Layer

### 15.1 开发者接入流程

```
开发者 → Developer Center
  │
  1. 注册账号（Identity Center）
  │
  2. 创建 API Key（API Key Registry）
  │
  3. 下载 SDK（SDK Registry）
  │
  4. 阅读文档（Documentation Registry）
  │
  5. 在线调试（Playground Registry）
  │
  6. 接入 {capability.resolve, runtime.execute, asset.upload}
  │     全部通过 API Key + SDK
  │
  7. 可选：注册 Webhook 接收事件
  │
  8. 可选：发布 Plugin 或 Template
```

### 15.2 Gateway 集成

```
Developer Center 注册到 Gateway 的路由:
  /api/developer/* → Developer Center
  /docs/*          → Developer Center (Documentation Registry)
  /openapi.json    → Developer Center (OpenAPI Registry)
```

### 15.3 OpenAPI 自动生成流程

```
  Center 启动 → 发布 center.started.v1
       │
       ▼
  Developer Center 收到事件
       │
       ▼
  调用 OpenAPIGenerator.generateSpec()
       │
       ▼
  合并所有 Center 的 Route + DTO + Event Schema
       │
       ▼
  生成 OpenAPI 3.1 规范
       │
       ▼
  发布 developer.openapi.generated.v1
```

---

> **Developer Center is not a Center that serves developers. It is the Platform Interface that developers see. Everything else is invisible.**
