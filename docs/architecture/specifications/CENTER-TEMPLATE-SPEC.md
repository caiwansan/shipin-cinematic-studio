# KMKI Platform — Center Template Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Predecessor**: Center SDK Specification v1.0  
> **Purpose**: 定义所有 Center 的标准目录结构、文件命名、脚手架生成器规范。确保 7 个已冻结 Center 的目录风格统一，未来所有 Center 使用 `npx kmki create-center` 生成。

---

## 1. Mission

整个 KMKI Platform 的"项目模板"。定义 Center 的目录结构、文件命名规则、脚手架工具 `create-center` 的行为、代码生成约定。任何新 Center 必须通过模板生成，不得手动搭建。

## 2. 目录结构规范

### 2.1 标准目录结构

```
{center-name}-center/
│
├── src/
│   ├── index.ts                  # 入口：createCenter() + center.start()
│   ├── config.ts                 # 配置：环境变量 → CenterConfig
│   ├── types.ts                  # Center 内部类型定义
│   │
│   ├── service/                  # 业务编排层
│   │   └── {module}.service.ts
│   │
│   ├── registry/                 # 业务能力注册/查询层
│   │   ├── index.ts              # 聚合导出
│   │   └── {module}.registry.ts
│   │
│   ├── repository/               # 数据访问层
│   │   ├── index.ts
│   │   └── {module}.repository.ts
│   │
│   ├── dao/                      # 数据库具体实现
│   │   ├── index.ts
│   │   └── {module}.dao.ts
│   │
│   ├── events/                   # 事件定义
│   │   ├── publish.ts            # 发布的事件声明
│   │   ├── subscribe.ts          # 订阅的事件处理器
│   │   └── schemas.ts            # 事件 Schema 定义
│   │
│   ├── dto/                      # 数据传输对象
│   │   ├── request/              # 请求 DTO
│   │   │   └── {action}.request.ts
│   │   ├── response/             # 响应 DTO
│   │   │   └── {action}.response.ts
│   │   └── index.ts
│   │
│   ├── middleware/               # Center 内部中间件
│   │   └── {name}.middleware.ts
│   │
│   ├── health.ts                 # 健康检查（自动合并到 /health）
│   ├── metrics.ts                # Metrics（自动注册到 Prometheus）
│   └── errors.ts                 # Center 自定义错误码
│
├── test/
│   ├── unit/
│   │   ├── services/
│   │   ├── registries/
│   │   └── repositories/
│   ├── integration/
│   │   └── {flow}.test.ts
│   └── e2e/
│       └── {flow}.e2e.ts
│
├── docs/
│   ├── README.md                 # 自动生成
│   ├── API.md                    # API 文档
│   ├── EVENTS.md                 # 事件文档
│   └── ARCHITECTURE.md           # Center 内部架构说明
│
├── openapi/
│   ├── openapi.yaml              # OpenAPI 3.0 规范（自动生成）
│   └── components/
│       ├── schemas.yaml
│       └── parameters.yaml
│
├── scripts/
│   ├── seed.ts                   # 测试数据种子
│   └── migrate.ts                # 数据库迁移
│
├── .env.example                  # 环境变量模板
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── jest.config.ts
├── Dockerfile
├── docker-compose.yml            # 包含依赖（如 redis, postgres）
└── package.json                  # name: "@kmki/{name}-center"
```

### 2.2 文件命名规则

| 层 | 命名模式 | 示例 |
|----|---------|------|
| Service | `{module}.service.ts` | `capability.service.ts` |
| Registry | `{module}.registry.ts` | `capability.registry.ts` |
| Repository | `{module}.repository.ts` | `capability.repository.ts` |
| DAO | `{module}.dao.ts` | `capability.dao.ts` |
| DTO (Request) | `{action}.request.ts` | `resolve.request.ts` |
| DTO (Response) | `{action}.response.ts` | `resolve.response.ts` |
| Event Publish | `publish.ts` | 固定 |
| Event Subscribe | `subscribe.ts` | 固定 |
| Health | `health.ts` | 固定 |
| Metrics | `metrics.ts` | 固定 |
| Config | `config.ts` | 固定 |
| Errors | `errors.ts` | 固定 |
| Test | `{module}.test.ts` | `capability.registry.test.ts` |

### 2.3 目录结构约束（范约束）

```
❌ 不允许: src/utils/helpers.ts     → 必须放在对应层内
❌ 不允许: src/lib/axios.ts         → 必须用 SDK 的 HTTP Client
❌ 不允许: src/common/types.ts      → 用 types.ts 统一管理
❌ 不允许: src/events.ts            → 必须放在 events/ 目录下
✅ 允许:   src/registry/capability.registry.ts   → 标准模式
✅ 允许:   src/service/capability.service.ts      → 标准模式
```

---

## 3. 脚手架生成器

### 3.1 CLI 规范

```bash
# 创建新 Center
npx kmki create-center Billing

# 选项:
--version      指定版本 (默认 1.0.0)
--registries   指定 Registry 列表 (逗号分隔)
--events       指定发布的事件列表
--deps         指定依赖的 Center
--template     使用已有 Center 作为模板
--dry-run      仅预览生成结构
```

### 3.2 交互式创建

```bash
$ npx kmki create-center
? Center name: Billing
? Version: 1.0.0
? Registries (comma-separated): InvoiceRegistry, SubscriptionRegistry, CouponRegistry
? Publish events: billing.invoice.created.v1
? Subscribe events: asset.storage.low.v1
? Dependencies: asset, identity
? Include Docker? Yes
? Include CI? Yes

Generating billing-center/
  ✓ src/index.ts
  ✓ src/config.ts
  ✓ src/types.ts
  ✓ src/service/invoice.service.ts
  ✓ src/service/subscription.service.ts
  ✓ src/registry/invoice.registry.ts
  ✓ src/registry/subscription.registry.ts
  ✓ src/events/publish.ts
  ✓ src/events/subscribe.ts
  ✓ src/events/schemas.ts
  ✓ openapi/openapi.yaml
  ✓ test/integration/invoice.test.ts
  ✓ README.md
  ✓ Dockerfile
  ✓ package.json
  ✓ tsconfig.json
  ✓ .env.example
Done! Next steps:
  1. cd billing-center
  2. npm install
  3. npm run dev
```

### 3.3 生成的文件范围

| 文件 | 生成策略 |
|------|---------|
| `src/index.ts` | 固定模板（createCenter + start）|
| `src/config.ts` | 固定模板 |
| `src/types.ts` | 根据 registry 声明生成基础类型 |
| `src/service/*.service.ts` | 每个 registry 生成一个 service 框架 |
| `src/registry/*.registry.ts` | 根据输入生成 registry 接口签名 |
| `src/events/publish.ts` | 根据 publish events 生成事件声明 |
| `src/events/subscribe.ts` | 根据 subscribe events 生成处理框架 |
| `openapi/openapi.yaml` | 根据 registry+DTo 生成 API 规范 |
| `README.md` | 包含所有 registry、事件、部署说明 |
| `Dockerfile` | 固定模板 |
| `package.json` | 自动注入 @kmki/center-sdk 依赖 |
| `tsconfig.json` | 固定模板 |
| `.env.example` | 自动添加 database/redis/eventBus 配置 |

---

## 4. 从已有 Center 提取模板

### 4.1 Template 抽取工具

```bash
# 从已冻结的 Center 目录提取模板
npx kmki extract-template capability-capability-center

# 生成一个蓝本，供 create-center 重用
# → templates/capability.yaml
```

### 4.2 蓝本文件格式

```yaml
# templates/capability.yaml
name: capability
registries:
  - name: CapabilityRegistry
    methods:
      - name: getCapability
        params: [capabilityId: string]
        returns: Capability
  - name: ProfileRegistry
    methods:
      - name: getProfile
        params: [capabilityId: string, version?: number]
        returns: CapabilityProfile
events:
  publishes:
    - capability.registered.v1
    - capability.deprecated.v1
  subscribes:
    - provider.registered.v1
    - model.registered.v1
dependencies:
  - identity
  - ai
# 以后可以直接用于新中心
```

---

## 5. 所有 Center 通用 README 模板

每个 Center 生成时自动包含以下 README 模板：

```markdown
# {displayName} (v{version})

## Overview
{description}

## Dependencies
{dependency list}

## Registries
{registry list with descriptions}

## Events
### Publish
{event list}
### Subscribe
{event list}

## API
详见 `openapi/openapi.yaml`

## Health
`GET /health`

## Metrics
`GET /metrics` (Prometheus format)

## Deployment
- Port: {port}
- Database: {database}
- Cache: {cache}
- Event Bus: {eventBus}

## SLO
| SLI | Target |
|-----|--------|
| Availability | 99.9% |
| Latency P95 | < 200ms |
| Error rate | < 0.5% |
```

---

## 6. 与 Developer Center 的集成

Center Template 生成的文档将自动被 Developer Center 消费：

```mermaid
Center Template → 生成 openapi.yaml → Developer Center 读取
                → 生成 README.md   → Developer Center 展示
                → 生成 events/     → Developer Center Event Catalog
                → 生成 health      → Developer Center Health Dashboard
```

---

> **Template 不是样板代码。Template 是架构约束的可执行形式。不通过 Template 生成的 Center 不被视为 KMKI Center。**
