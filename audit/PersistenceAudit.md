# Audit G: 持久化审计 (PersistenceAudit.md)

## 1. 数据持久化层级

昆仑镜系统使用 5 个持久化层级:

| 层级 | 技术 | 用途 |
|------|------|------|
| L5 - Database | PostgreSQL (Prisma) | 业务数据主存储 |
| L4 - Cache | Redis | 分布式状态/队列/缓存 |
| L3 - Memory | Node.js 进程内存 | 临时状态/轻量队列 |
| L2 - Local | LocalStorage/SessionStorage | 前端客户端数据 |
| L1 - File | MinIO/文件系统 | 媒体文件 |

## 2. 仅存在 Store/Memory 的数据

### 2.1 仅在前端 Store/Reactive 中的数据 (无 DB 持久化)

| 数据 | 位置 | 存储方式 | 风险 |
|------|------|----------|------|
| Admin auth_token | `frontend/layouts/admin-aigc.vue` | localStorage | 刷新后丢失? |
| UI 临时状态 | 各组件 reactive/ref | 组件内存 | 页面刷新丢失 |
| SSE 连接状态 | `composables/useSSEStream.ts` | 内存 | 断连后丢失 |
| Pipeline 编辑状态 | `composables/usePipeline.ts` | 内存 | 未保存丢失 |
| 未保存的 workspace 编辑 | 各 workspace 组件 | 内存 | 刷新丢失 |

### 2.2 仅存在 Redis 中的数据 (无 DB 备份)

| 数据 | 位置 | 用途 | 风险 |
|------|------|------|------|
| BullMQ 队列状态 | `queue/` | 任务队列 | Redis 宕机丢失 |
| 分布式状态 | `utils/redis-state.ts` | PM2 集群状态 | 重启丢失 |
| OAuth state | `routes/qq-oauth.ts:12` | CSRF 防护 | 内存存储, 多实例问题 |
| OAuth state (微信) | `routes/wechat-oauth.ts:10` | CSRF 防护 | 同上 |

### 2.3 仅存在于内存的数据 (无任何持久化)

| 数据 | 位置 | 文件 |
|------|------|------|
| 轻量任务队列 | `jobs/job-queue.ts:5` | 注释: "不需要 Redis" |
| Prompt Cache | `agents/prompt-service.ts:41` | `promptCache = new Map()` |
| 内存速率限制 | `routes/auth.ts:8` | 注释: "重启后重置，生产环境应用 Redis" |
| 内存 mission store | `services/geo/mission-engine/routes.ts:13` | 注释: "可替换为 Redis" |

## 3. 持久化模式不一致

### 3.1 Token/凭据存储模式

| Token 类型 | 存储位置 | 持久化方式 |
|-----------|----------|-----------|
| User JWT | localStorage | 前端持久化 |
| Admin JWT | localStorage | 前端持久化 |
| OAuth Token | localStorage | 前端临时存储 |
| API Keys | .env | 服务器环境变量 |
| Provider Credentials | `resource_credential` 表 | PostgreSQL |
| Platform API Keys | `api_key` 表 | PostgreSQL |

**问题**: 混合使用 localStorage 和 httpOnly cookie，未使用 secure flag

### 3.2 配置存储碎片化

| 配置类型 | 存储位置 |
|----------|----------|
| AI Model 配置 | `ai_stage_model_config` 表 |
| Provider 配置 | `model_provider` 表 |
| 系统配置 | `.env` 环境变量 |
| 运行时配置 | `user_model_config_v2` 表 |

## 4. 数据丢失风险

| 风险 ID | 描述 | 严重等级 |
|---------|------|----------|
| G-001 | 内存队列重启丢失任务 | MEDIUM |
| G-002 | OAuth state 内存存储不支持多实例 | HIGH |
| G-003 | SSE 状态断连丢失 | MEDIUM |
| G-004 | Prompt Cache 内存过期不持久化 | LOW |
| G-005 | 轻量队列无持久化保障 | MEDIUM |

## 5. 修复建议

1. **OAuth state**: 迁移到 Redis 或 DB
2. **Token 存储**: 使用 httpOnly cookie 替代 localStorage
3. **内存队列**: 至少使用 DB-backed 队列
4. **Prompt Cache**: 使用 Redis 或永不过期的缓存策略
5. **配置统一**: 所有运行时配置使用 Config Runtime
