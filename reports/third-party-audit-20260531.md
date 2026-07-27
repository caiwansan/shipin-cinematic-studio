# 第三方架构审查报告 — 昆仑镜系统（Kunlun Mirror）
**日期**: 2026-05-31  
**审查范围**: 前端、后端、架构、安全、性能与稳定性  
**审查目标**: https://aigc.fushtn.com/studio/v2  
**仓库路径**: `/root/shipin-cinematic-studio/`

---

## 1. 执行摘要

昆仑镜系统是一个大型 AI 短剧制作平台，包含前端（Nuxt 3 + Pinia + TailwindCSS）和后端（Fastify + Prisma + PostgreSQL + Redis + BullMQ + 多AI Provider适配）两大部分。

**总体评估**: 这是一个功能极其丰富、架构雄心勃勃的系统，但存在严重的代码质量与工程实践问题。后端在快速迭代中积累了：

- **404 个 TypeScript 编译错误**，分布在 132 个源文件中
- 大量重复导出、断链模块引用、类型不匹配
- 未通过 Prisma migration 管理的 4 个裸 SQL 脚本
- 生产环境 .env 泄露了敏感 API Key（可被利用）
- 165 个 Prisma 模型 vs 16 个 migration — 大量表无 migration 记录
- 前端的 pipeline store 同时用 localStorage + 后端双写，有竞争风险
- 系统在运行时会在 catch {} 中静默吞异常

---

## 2. 前端审查

### 2.1 编译构建

**状态: ✅ 构建成功**

`nuxt build` 在 8.5 秒内完成，无 error。构建输出正常：
- Client bundle: 8489ms
- Server bundle: 19ms
- Total: ~8.5s

nitro.mjs 补丁脚本报了 `nitro.mjs not found` 但属于非致命告警。

### 2.2 Store/Pinia 运行时状态泄漏

**风险: ⚠️ 中风险**

- **`stores/pipelineStore.ts`** — pipeline store 包含完整的依赖图和工作流执行逻辑（`completeAndExecuteNext`, `findNextDownstream`, `enterStage` 等），属于 execution/orchestration 逻辑驻留在前端的反模式。store 中没有发现直接调用 AI 模型 API（image/video/llm/tts），但包含了完整的工作流编排状态机。
- **`stores/projectRuntime.ts`** — 包含 event reducer、stage data 管理，属于 execution/runtime state 泄漏到前端。
- **`stores/directorRuntime.ts`** — 约 550 行的庞大 store，包含 productionStatus, pipelineStages, runtimeState 等应该在后端管理的状态。

### 2.3 硬编码的 provider/模型名称

**风险: ✅ 基本可控**

前端 stores 中未发现硬编码的 provider 名称（如 `volcengine`、`aliyun` 等），这些信息通过 API 获取。但 `stores/pipelineStore.ts` 中的 `WORKFLOW_LABELS`、`WORKFLOW_ORDER`、`DEPENDENCY_GRAPH` 是硬编码的业务逻辑。

### 2.4 零引用的组件/页面/工具函数

**风险: ⚠️ 低风险**

- `stores/project.ts` — 使用 mock 数据（`MOCK_PROJECTS` 为空数组），`fetchProjects` 不调用后端 API，仅设置空数组。这个 store 可能未使用或已被新 store 替代。
- `stores/showrunnerJob.ts` — 需要检查是否存在活跃引用。

### 2.5 数据流双写风险

**风险: ❌ 高风险**

`stores/pipelineStore.ts` 中存在明显的**双写问题**：
1. **localStorage 缓存**：`persistPipeline()` 写入 `localStorage.setItem(PERSIST_KEY_V3, ...)`
2. **后端同步**：同一方法内立即调用 `syncAllStagesToBackend()` 写入后端 API
3. **竞争条件**：`hydratePipelineFromBackend()` 中后端优先 → localStorage 回退，但 `persistPipeline` 的 watch 在每次变化时触发，可能导致短时间内多次写入
4. **静默吞异常**：`syncAllStagesToBackend()` 中 `catch {}` 忽略网络错误

具体风险场景：
- 多个浏览器标签页同时写入 localStorage → 覆盖数据
- 后端和 localStorage 版本不一致时，选择后端的逻辑可能丢失最近的前端操作

### 2.6 控制台错误/警告

由于无法直接访问线上运行时控制台，这部分无法评估。但从前端代码中可观察到：
- `stores/pipelineStore.ts` 中使用了 `window.dispatchEvent(new CustomEvent('pipeline-advance', ...))` — 可能导致 SSR 错误
- `stores/pipelineStore.ts` 中 `bootstrapClean()` 的 `try {}` 空块

---

## 3. 后端审查

### 3.1 TypeScript 编译错误

**严重度: 🔴 P0 — 系统无法编译到 dist**

`tsc --noEmit` 结果：
- **404 个 TypeScript 编译错误**
- **132 个源文件**有错误
- 分布在 `director-v2/`、`routes/`、`model-adapters/`、`runtime/`、`services/` 等几乎所有核心模块

主要错误类型：

| 错误类型 | 示例 | 影响范围 |
|---------|------|---------|
| 模块未找到 (TS2307) | `Cannot find module './director-projection.js'` | 至少 10 个文件 |
| 属性不存在 (TS2339) | `Property 'TTS' does not exist on type 'typeof Capability'` | ~20 处 |
| 类型不匹配 (TS2322) | `Type 'Record<string, unknown>' not assignable to Json` | ~30 处 |
| 重复标识符 (TS2300) | `Duplicate identifier 'staticPathScanner'` | 1 处 (index.ts 中重复 export) |
| 隐式 any (TS7006) | `Parameter 's' implicitly has an 'any' type` | ~30 处 |
| 无法找到名称 (TS2304) | `Cannot find name 'T'` | 泛型缺失 |
| readonly 赋值错误 (TS4104) | `readonly ... cannot be assigned to mutable type` | `ir-compiler-lock.ts` |
| 编译选项冲突 | `module: "commonjs"` + `import()` 动态导入 | 全局 |

**特别关注**：
- `src/index.ts` 本身有编译错误（动态 `import()` 在 `module: commonjs` 下不被允许）
- `src/core/verification/execution-plane/index.ts` — 同一变量被导出两次（复制粘贴错误）
- `src/director-v2/memory/constitution-store.ts` 引用了 `./constitution-fingerprint.js` — 该文件不存在

### 3.2 路由注册完整性

**状态: ⚠️ 有注释掉的导入**

`src/index.ts` 中：
- `registerStudioRoutes` — 已删除（注释注明）
- `autograph routes` — 已删除（注释注明）
- `userApiKeyRoutes`、`userModelConfigRoutes`、`userModelConfigV2Routes` — **被注释掉**但文件仍存在（`src/routes/user-model-config.ts`、`src/routes/user-model-config-v2.ts`、`src/routes/user-api-keys.ts` 都存在）
- 替代方案：`unifiedModelConfigRoutes` 已注册

未注册的路径文件（`src/routes/` 目录下存在但未在 index.ts 中注册）：
- `user-api-keys.ts` ✅ (注释掉)
- `user-model-config.ts` ✅ (注释掉)
- `user-model-config-v2.ts` ✅ (注释掉)

### 3.3 barrel export 断链

**发现 1 处明显错误**:
- `src/core/verification/execution-plane/index.ts` — 同一 export 出现两次（复制粘贴导致 `staticPathScanner, staticPathScanner` 等，导致 TS2300 duplicate identifier）

### 3.4 Prisma Schema 完整性

**严重度: 🔴 P0 — schema 与 migration 严重不一致**

- **Schema 定义**: 165 个 model
- **已应用的 migration**: 16 个（全部在 `prisma/migrations/2026.../` 目录下）
- **未管理的 SQL 脚本**: 4 个（`add_resilience.sql`、`add_user_model_config_v2.sql`、`add_user_model_config_v2_llm.sql`、`step6_shadow.sql`）

schema 中定义但 migration 未覆盖的表（估计 120+ 个表缺少 migration），包括但不限于：
- 核心表: `PipelineStage`、`PipelineJob`、`CharacterImage`、`SceneImage`、`StoryboardImage`、`FrameImage`
- Director V2: `AgentDef`、`AgentEdge`、`WorkflowDef`、`AgentExecution`、`AgentMemory`
- 资产经济: `AssetDna`、`AssetLineage`、`ContributionWeight`、`RevenueSplit`
- OMS/世界观: `World`、`Observer`、`Event`、`Character`、`CharacterMemory`
- 运行时: `TaskQueue`、`TaskExecution`、`DAGGraph`、`DAGState`、`GPUNode`
- Kernel: `KernelEvent`、`KernelStateSnapshot`、`RuntimeRegistry`、`SchedulerTask`
- 社区: `CommunityCategory`、`CommunityPost`、`CommunityComment`
- 存储: `StorageConfig`、`ProviderState`、`RouteConfig`、`InvocationLog`

**Prisma 迁移状态**: `prisma migrate status` 报告 "Database schema is up to date" — 这意味着当前数据库是通过 `prisma db push` 直接同步的，而非通过 migration 跟踪。这是**危险做法**——无法回滚、无法版本控制、本地和生产数据库可能不一致。

### 3.5 依赖分析

**未使用的依赖（潜在）**:

| 依赖 | 说明 |
|------|------|
| `express` | 未在任何 src/ 中的源代码中使用（仅 backup 文件引用），但作为 production dependency 存在 |
| `@fastify/websocket` | package.json 中声明，但 `src/index.ts` 中未注册 |

**已确认使用的依赖**: fastify、@fastify/jwt、@fastify/multipart、@fastify/static、prisma、bullmq、ioredis、zod、bcryptjs、sharp 等均在使用中。

### 3.6 .env 安全

**严重度: 🔴 P0 — 敏感信息直接泄露**

`.env` 文件中包含的敏感信息：

```env
JWT_SECRET=40872ec871074e0d3e125593aed9e00fbac5629e213fbe6e073f52ddb2c07ff3
ALIYUN_API_KEY=sk-fe9bfcb6ce4a45c6b40ccd25381c8617
VOLCENGINE_API_KEY=e7451bd2-bb62-4a53-a4a7-c0fb1ceb931f
MINIO_ACCESS_KEY=663876de7b2c026016e47ba6
MINIO_SECRET_KEY=e7f3a8b66eaf0ebcce6d9b5b98ef6a56475d4b6a34a1fb3d
CRYPTO_ENCRYPTION_KEY=798bf092f3003cd9d3f94cd6230a9e8120f1dd0e4e9fc9a8e3550a487b95341e
```

所有密钥均为**硬编码明文**。CRYPTO_ENCRYPTION_KEY 用于数据库字段加密，泄露后所有加密存储的 API Key 均可被解密。

### 3.7 环境变量默认值安全

`src/config/env.ts` 中定义了 Zod schema 来解析环境变量，但存在**默认值安全风险**：

```typescript
JWT_SECRET: z.string().default('dev-secret-change-in-production-aigc-only'),
```

生产环境如果忘记设置 JWT_SECRET 环境变量，将使用开发密钥 `dev-secret-change-in-production-aigc-only`。同样，MinIO、Redis、PostgreSQL 都使用弱/开发默认值。

### 3.8 错误处理 — 静默吞异常

**严重度: ⚠️ 中风险**

发现大量 `catch {}` 或 `catch () {}` 不处理异常，其中许多位于关键业务逻辑中：

- `src/plugins/auth.ts:98` — `catch(() => {})` 在 JWT 验证后的数据库更新中
- `src/routes/observability.ts` — 多处 catch 块
- `src/index.ts` — 多处 `try { ... } catch(err) { console.warn(...) }` 在启动流程中
- `src/routes/images.ts`、`member.ts`、`payment.ts` 等 — 多处 catch 后仅返回 500 而不记录详细错误

### 3.9 Package.json 脚本

`prebuild` 和 `build` 脚本执行了 5 个验证脚本（runtime-topology-check、validate-layer-deps、aes-v2、aes-v3）后才运行 tsc，这增加了构建的复杂性和失败点。

---

## 4. 架构审查

### 4.1 路由 prefix 一致性

**状态: ⚠️ 不一致**

`src/index.ts` 中的注册模式不一致：
- 大多数路由直接注册 `await app.register(routes)` 无 prefix
- 少数使用 prefix：`sceneRoutes`/`assetRoutes`/`imageRoutes`/`executionImageRoutes` with `{ prefix: '/api' }`
- `modelSelectionRoutes` with `{ prefix: '/api/v1/authority' }`
- `rfvlRoutes` with `{ prefix: '/api' }`

这导致部分 API 路径为 `/api/...`，部分直接为 `/...`。例如 `/api/characters` 和 `/api/v1/authority/...` 与没有 prefix 的 `/auth/...` 路径结构不一致。

### 4.2 流水线阶段定义

**严重度: ⚠️ 中风险**

前端定义 (`stores/pipelineStore.ts`):
- 9 个阶段: `story → character → scene → voice → storyboard → frame → director → composite → export`
- 依赖图 `DEPENDENCY_GRAPH` 为线性全依赖链（每个阶段依赖前面所有阶段）

后端定义:
- `PipelineStage` 模型使用 `stageKey` 字段（`character`、`scene`、`storyboard`、`voice`、`frame`、`director`）
- `PipelineJob` 模型：`jobType` 字段（`image_generate`、`voice_generate` 等）
- 两者定义的阶段**名字不一致**（前端有 `story`、`composite`、`export`；后端 PipelineStage 缺少这些）

前端 stageList 和后端 DAG **未对齐**，可能导致运行时找不到匹配的阶段。

### 4.3 UserModelConfig 工作流

**严重度: ⚠️ 边界可运行的混乱**

存在两个配置系统：
1. **UserModelConfig (V1)** — 多字段、多 provider 分别指定
2. **UserModelConfigV2 (V2)** — 单行配置、Single Source of Truth

当前状态：
- 两个表的 API routes 均在 index.ts 中被**注释掉**（`// await app.register(userModelConfigRoutes)`）
- 替代方案使用 `unified-model-config.ts` 路由
- 但 `src/plugins/auth.ts` 仍在读取 V1 `UserModelConfig`（见第 63 行注释 `"应迁移到 V2"`）
- `runtime/with-user-model-config.ts` 有编译错误

这意味着**模型配置工作流是断裂的**：后端部分地方读 V1，部分地方读 V2，前端调用 `unified-model-config` API。

### 4.4 各任务完整链路

**基本链路存在**：前端 → API → Queue → Worker → Adapter → Provider

- **图片生成**: `routes/images.ts` → 直接调用 adapter 或通过 task-queue → worker-runtime → 各 image adapter
- **视频生成**: `routes/ai-tasks.ts` → BullMQ → worker → video adapter
- **LLM 调用**: 通过 `services/aliyun-llm.provider.ts`、`services/volcengine-llm.provider.ts` 等
- **TTS**: `routes/tts.ts` → `services/aliyun-tts.provider.ts`

但许多 adapter 有编译错误（如 `siliconflow-image.adapter.ts`、`wan-image.adapter.ts`、`qwen-image.adapter.ts` 等），运行时可能无法正常工作。

### 4.5 部署脚本完整性

**前端部署**: 有 `ecosystem.config.cjs` 使用 PM2，build 命令通过 `nuxt build` + `patch-manifest.mjs` 进行

**后端部署**: 
- `ecosystem.config.cjs` 配置了 PM2（`api-server-aigc`）
- `scripts/build-dist.sh` 是定制的 dist 构建脚本，但**实际构建命令是 `npx tsc`**，而 tsc 有 404 个错误
- `build` 脚本中存在大量验证步骤（runtime-topology-check、validate-layer-deps、aes-v2、aes-v3），增加了构建延迟和失败风险
- **当前没有 `dist/` 目录**，意味着系统尚未完成编译

**缺失的脚本**：
- 没有完整的一键部署脚本（前端 build + 后端 build + 静态资源复制 + pm2 restart）
- 没有数据迁移脚本（需要 `prisma migrate deploy`）

---

## 5. 安全审查

### 5.1 密钥硬编码

**严重度: 🔴 P0**

见 3.6 节。`.env` 文件中 7 个密钥全部为明文硬编码，包括：
- JWT_SECRET（用于 token 签名）
- 三个 AI provider API Key（阿里云 DashScope、火山引擎）
- MinIO 对象存储密钥
- CRYPTO_ENCRYPTION_KEY（用于加密数据库中的 API Key）

### 5.2 API 认证完整性

**状态: ⚠️ 不完整**

- `src/plugins/auth.ts` 实现了 JWT 认证
- API Key 向量检查逻辑存在但使用 V1 表（应使用 V2）
- 社区系统认证完整（post/comment/like 等路由有认证中间件）
- `src/routes/models.ts` 中的 `/api/v1/models/available` 确认无认证（公开 API）
- `src/routes/system-version.ts` 中的 `/api/system/version` 公开

### 5.3 未鉴权写操作

**状态: ⚠️ 部分风险**

- 大多数写操作路由（如 auth、projects、storyboards 等）都使用了 `{ preHandler: [fastify.authenticate] }`
- 但认证插件中的 API Key 检查路径 `AI_API_PREFIXES` 列表是硬编码的，新增路由容易遗漏

### 5.4 JWT 配置

**严重度: ⚠️ 中风险**

- JWT 使用 `HS256`（对称密钥），`JWT_SECRET` 写死在 `.env` 中
- 单设备登录检查通过 `tokenVersion` 实现（每次发新 token 递增版本）
- 但 `JWT_SECRET` 泄露后，所有历史 token 可被伪造
- `env.ts` 中默认值为开发密钥

---

## 6. 性能与稳定性

### 6.1 前端无状态缓存管理

**严重度: ⚠️ 中风险**

- pipeline store 使用 localStorage 做缓存 + 后端同步，但没有缓存失效或版本冲突的优雅处理
- `hydratePipeline` 优先从后端加载，但 `persistPipeline` 的 watch 可能触发不必要的后端同步
- 多个标签页同时操作同一项目 → localStorage 不一致

### 6.2 SSE/WebSocket 连接管理

- `src/transport/sse/` 实现了 SSE 事件推送系统（`sse-route.ts`、`sse-subscriber.ts`、`execution-event-bus.ts`）
- `registerSSEStream(app)` 在 index.ts 中被调用
- `@fastify/websocket` 声明在 package.json 中，但未在 index.ts 中显式注册为插件

### 6.3 队列长度监控

- 有 `SystemMetric` 和 `ReplayFrame` 模型用于指标持久化
- 有 `system-dashboard` 和 `runtime-observability` 路由
- 但没有监控报警机制（无阈值检查、无告警通知）

### 6.4 PM2 配置

- 后端 PM2 配置为单实例 fork 模式（`instances: 1`、`exec_mode: 'fork'`）
- 前端 PM2 配置同样为单实例
- 没有 `max_memory_restart` 或日志轮转配置
- 没有 `log_date_format` 或日志轮转型号

### 6.5 日志轮转

- `ecosystem.config.cjs` 中**没有**任何日志轮转配置
- 默认情况下 PM2 日志会无限增长
- `backend/logs/` 目录存在但未配置轮转

---

## 7. 总结：问题列表

### P0 — 严重（必须立即修复）

| ID | 描述 | 模块 |
|----|------|------|
| P0-1 | **404 个 TypeScript 编译错误**在 132 个文件中，系统无法编译为 dist | 后端全量 |
| P0-2 | **`.env` 泄露全部密钥**：JWT_SECRET、3 个 AI API Key、MinIO Key、CRYPTO_ENCRYPTION_KEY 均为明文 | 后端配置 |
| P0-3 | **Prisma schema 与 migration 严重不一致**：165 个 model → 仅 16 个 migration → 4 个裸 SQL 脚本未受管理 | 后端数据库 |
| P0-4 | **Express 作为 production dependency 但未使用** | package.json |

### P1 — 高风险

| ID | 描述 | 模块 |
|----|------|------|
| P1-1 | **双写风险**：前端 pipeline store 同时写入 localStorage + 后端，存在竞条件 | frontend/stores |
| P1-2 | **execution/orchestration 逻辑驻留前端**：pipelineStore 包含完整状态机和 DAG 逻辑 | frontend/stores |
| P1-3 | **JWT_SECRET 有开发默认值**：`env.ts` 中 `default('dev-secret-change-in-production-aigc-only')` | 后端配置 |
| P1-4 | **barrel export 重复**：`src/core/verification/execution-plane/index.ts` 重复导出同一变量 | 后端核心 |
| P1-5 | **`catch {}` 静默吞异常**广泛存在，影响可观测性和调试 | 后端全量 |
| P1-6 | **UserModelConfig V1 vs V2 双系统共存**，部分代码读 V1，部分读 V2 | 后端 auth/runtime |
| P1-7 | **前端 pipeline stages 与后端 DAG 定义不一致**（前端 9 个阶段，后端 PipelineStage 不同） | 前后端 |

### P2 — 中风险

| ID | 描述 | 模块 |
|----|------|------|
| P2-1 | 路由 prefix 不一致（部分 `/api/`，部分直接 `/`） | 后端 index.ts |
| P2-2 | 3 个 route 文件在 index.ts 中被注释（user-api-keys、user-model-config、user-model-config-v2） | 后端 routes |
| P2-3 | 没有一键部署脚本（前端 build + 后端 build + 迁移 + pm2 restart） | 部署 |
| P2-4 | PM2 配置缺少日志轮转和内存限制 | ecosystem.config |
| P2-5 | `frontend/stores/project.ts` 使用 mock 数据，可能已废弃 | 前端 stores |
| P2-6 | `@fastify/websocket` 声明但未注册 | 后端 package.json |
| P2-7 | 多个 init 过程在 `try/catch` 中仅打印 `warn` 不阻止启动 | 后端 index.ts |

### P3 — 低风险 / 建议

| ID | 描述 | 模块 |
|----|------|------|
| P3-1 | `checksum` 拼写错误（应为 `checksum` → `checksum`） | LocalAssetIndex schema |
| P3-2 | 前端 build 后 nitro.mjs 补丁找不到文件（非致命） | nuxt.config.ts |
| P3-3 | `bootstrapClean()` 在 `try {}` 空块中 | pipelineStore.ts |
| P3-4 | 缺少 `prebuild` 脚本可能因验证脚本失败而阻止构建 | package.json |
| P3-5 | `scripts/dist-build.sh` 构建流程复杂，生产环境可能不需要 | 后端脚本 |

---

## 8. 修复建议

### P0 建议（立即修复）

1. **修复 TypeScript 编译错误** — 分批次修复：
   - Phase 1: 修复 barrel export 重复（execution-plane/index.ts）和模块断链（约 20 处 `Cannot find module`）
   - Phase 2: 修复类型不匹配（Json 类型约束）
   - Phase 3: 修复 director-v2 中大面积的类型错误
   - 或放宽 `skipLibCheck: true` + `strict: false` 临时性通过编译

2. **替换 .env 密钥** — 立即废弃当前所有密钥：
   - 生成新的 JWT_SECRET、CRYPTO_ENCRYPTION_KEY
   - 轮换所有 AI provider API Key
   - 使用环境变量注入，不将 .env 放入版本控制
   - 使用密钥管理服务（阿里云 KMS/Secrets Manager 等）

3. **Prisma migration 治理**：
   - 将 4 个裸 SQL 脚本转换为 Prisma migration
   - 执行 `prisma migrate diff` 生成缺失表的 migration
   - 将 `db push` 切换为 `migrate deploy`

4. **移除 express 依赖**（删除 `package.json` 中的 `express` 条目）

### P1 建议

5. **消除前端 execution 逻辑** — 将 pipelineStore 中的状态机逻辑移至后端，前端只做 UI 投影

6. **双写改单写** — 决定使用 localStorage 还是后端作为 SSOT：
   - 推荐：后端为主，localStorage 仅做离线 fallback
   - 添加版本号和时间戳解决竞争

7. **修复 JWT 默认值** — 移除 `env.ts` 中的默认 JWT_SECRET，没有密钥时拒绝启动

8. **统一 UserModelConfig** — 完全迁移到 V2，删除 V1 代码路径

9. **添加 catch 日志** — 所有 `catch {}` 至少 log error

### P2 建议

10. 统一路由 prefix 策略（建议全部 `/api/v2/...`）
11. 创建一键部署脚本
12. PM2 添加 `max_memory_restart`、`log_date_format`、`rotate_module`
13. 添加健康检查 + 队列深度监控 + 告警

### P3 建议

14. 修复打字错误（checksum → checksum 等）
15. 清理未使用的依赖和 mock 代码
16. 优化构建脚本，减少不必要的预构建验证步骤

---

*报告结束。本报告仅作调查记录，未对系统代码进行任何修改。*
