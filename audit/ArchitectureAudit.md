# Audit A: 系统架构审计 (ArchitectureAudit.md)

## 1. 多真相源问题

### 1.1 前端状态真相源 (5+ 个)

| 真相源 | 位置 | 用途 |
|--------|------|------|
| Pinia Store | `frontend/stores/`, `frontend/modules/*/store/` | 项目/用户/auth 状态 |
| Composable | `frontend/composables/` | 业务逻辑状态 |
| LocalStorage | 多处引用 | OAuth token, auth_user, auth_token |
| SessionStorage | 全局 | (未广泛使用) |
| Vue Reactive | 组件本地 | 临时UI状态 |

**Evidence**: 26+ Pinia stores + 15+ composables + 3 localStorage auth keys

**调用链冲突示例**:
- `frontend/stores/auth.ts` 的 getToken() 回退链: 内存 → token-cache → localStorage
- `frontend/layouts/admin-aigc.vue` 直接从 localStorage 读 `auth_token`
- `frontend/plugins/auth-init.client.ts` 从 localStorage 恢复 token

### 1.2 后端状态真相源 (5+ 个)

| 真相源 | 位置 | 数据 |
|--------|------|------|
| PostgreSQL | Prisma Schema | 324 表 |
| Redis | `queue/redis.ts`, `utils/redis-state.ts` | 分布式状态/队列 |
| Memory | `jobs/job-queue.ts` | 轻量队列 |
| File System | `public/uploads/` | 媒体文件 |
| OSS/COS | MinIO/OSS | 备份存储 |

**问题**: Redis 有两个客户端 (`queue/redis.ts` + `utils/redis-state.ts`)，未共享连接池。

### 1.3 Workbench 真相源 (5+ 个独立实现)

见 Audit H (WorkspaceAudit.md)

## 2. 重复业务逻辑

### 2.1 AI 调用重复 (4 条路径)

| # | 路径 | 文件 |
|---|------|------|
| 1 | route → provider-registry → provider | `runtime/provider-registry.ts` |
| 2 | route → model-adapters → provider | `model-adapters/*/` |
| 3 | queue → worker-runtime → provider | `queue/worker-runtime.ts` |
| 4 | route → services → provider (direct call) | `services/*.ts` |

### 2.2 Token 验证重复逻辑

- `plugins/auth.ts` — Fastify JWT verify (主路径)
- `routes/sms-auth.ts` — 手动 jwt.sign/jwt.verify
- `routes/qq-oauth.ts` — 手动 jwt.sign + verifyToken
- `routes/ai-optimize-ad-script.ts` — 手动 jwt.verify
- `routes/narrative-llm.ts` — 手动 jwt.verify

### 2.3 数据库访问模式重复

- Prisma ORM 为主
- 另有 >=30 处 `$queryRawUnsafe`/`$executeRawUnsafe`
- 混用 ORM 和 Raw SQL 增加一致性风险

### 2.4 配置读取重复

- `config/env.ts` — Zod schema 验证
- `config/v2.ts` — 另一套配置
- `config/saveUnified.ts` — 统一保存
- 多处直接 `process.env.X` 读取

## 3. Runtime 统一性

### 3.1 当前 Runtime 组件

| Runtime 名称 | 路径 | 职责 |
|-------------|------|------|
| Runtime Core | `runtime/` | AI 执行主入口 |
| Runtime Guard | `runtime/runtime-guard.ts` | Guard 层 |
| Runtime Gateway | `runtime/runtime-gateway.ts` | 网关 |
| Runtime Registry | `runtime/provider-registry.ts` | Provider 注册 |
| Runtime Credential | `runtime/runtime-credential.ts` | 凭据 |
| Runtime Prompt | `runtime/prompt/` | Prompt 管理 |
| Runtime Routing | `runtime/routing/` | 模型路由 |
| Runtime Schema | `runtime/schema-validator/` | Schema 校验 |
| Runtime Config | `config-runtime/` | 配置运行时 |
| Decision Runtime | `decision-runtime/` | 决策运行时 |
| Schema Runtime | `schema-runtime/` | Schema 运行时 |

### 3.2 Runtime 碎片化

至少 5 个独立 "Runtime" 系统并存:
1. `runtime/` — 主 AI Runtime
2. `decision-runtime/` — 决策 Runtime
3. `config-runtime/` — 配置 Runtime
4. `schema-runtime/` — Schema Runtime
5. `core-runtime/` — Core Runtime

### 3.3 绕过 Runtime 的直接调用

以下路径直接调用 Provider 不经过 Runtime:
- `routes/customer-service.ts:287` — 直接 fetch LLM
- `routes/narrative-llm.ts` — 直接调 LLM
- `production-loop/video/*.ts` — 直接调视频 Provider
- `services/deepseek-llm.provider.ts` — 直接调用
- `services/xinghuo-ws.provider.ts` — 直连星火

## 4. 架构复杂度统计

| 指标 | 数值 |
|------|------|
| 源码文件 (backend .ts) | 2,288 |
| 源码文件 (frontend .ts/.vue) | 1,048 |
| 总计源代码文件 | 4,594 |
| 数据库模型 | 324 |
| index.ts 入口点 | 223 |
| Routes 文件 | 100+ |
| Services 文件 | 200+ |
| 配置文件 | 8+ |
| 历史遗留目录 | 10+ |

## 5. 修复建议

1. **统一状态管理**: 所有前端状态收敛到 Pinia, 消除 localStorage 直接读取
2. **单一 AI 调用入口**: 消除 model-adapters/production-loop/services 中的直连, 全部走 runtime
3. **消除 Raw SQL**: 全部替换为 Prisma ORM 方法
4. **统一 Runtime**: 合并 5 个 Runtime 为 1-2 个明确分层
5. **统一配置**: 所有配置走 config/env.ts Zod schema
